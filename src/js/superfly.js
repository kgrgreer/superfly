var stack = [], heap = [], hp, __arrayStart__ = '__arrayStart__';
function fn(f) { return code => code.push(f); }
function bfn(f) { return fn(() => { var b = stack.pop(), a = stack.pop(); stack.push(f(a, b)); }); }
var scope = {
  readChar: function() { return this.ip < this.input.length ? this.input.charAt(this.ip++) : undefined; },
  readSym:  function() {
    var sym = '', c;
    while ( c = this.readChar() ) {
      if ( /\s/.test(c) ) { if ( sym ) break; else continue; }
      sym += c;
    }
    return sym;
  },
  eval$: src => {
    var oldInput = scope.input, oldIp = scope.ip;
    scope.input = src;
    scope.ip    = 0;
    for ( var sym ; sym = scope.readSym() ; )
      scope.evalSym(sym, { push: f => f() });
    scope.input = oldInput;
    scope.ip    = oldIp
  },
  eval: code => { code.push(() => scope.eval$(stack.pop())); },
  evalSym: function(line, code) {
    var sym = scope[line];
    if ( sym ) { sym(code); }
    else if ( line.startsWith(':') ) {
      var sym = line.substring(1);
      code.push(function() { var value = stack.pop(); scope[sym] = function(code) { code.push(function() { stack.push(value); }); } });
    } else if ( line.charAt(0) >= '0' && line.charAt(0) <= '9' || ( line.charAt(0) == '-' && line.length > 1 ) ) {
      code.push(function() { stack.push(Number.parseFloat(line)); });
    } else if ( line.indexOf('.') != -1 ) { // Macro for OO calling convention
      // TODO: add an in-ilne cache here
      var a = line.split('.');
      code.push(function() { stack.push(a[1]); });
      this.evalSym(a[0], code);
      code.push(function() { stack.push(stack[stack.length-1]); });
      this.evalSym('()', code);
    } else if ( line.startsWith("'") ) {
      var s = line.substring(1);
      code.push(function() { stack.push(s); });
    } else {
      console.log('Warning: Unknown Symbol or Forward Reference "' + line + '" at:', scope.input.substring(scope.ip, scope.ip+40).replaceAll('\n', '\\n'), ' ...');
      code.push(function() { scope[line]({ push: function(f) { f(); }})});
    }
  },
  '{': function(code) {
    var l, oldScope = scope, vars = [], fncode = [];
    var curScope = scope = Object.create(scope);
    while ( ( l = scope.readSym() ) != '|' ) vars.push(l); // read var names
    function countDepth() { var d = 0, s = scope; while ( s !== curScope ) { s = s.__proto__; d++; } return d; }
    function moveUp(d) { var p = hp; for ( var i = 0 ; i < d ; i++ ) p = heap[p]; return p; }
    for ( let i = 0 ; i < vars.length ; i++ ) {
      let index = vars.length-i;
      scope[vars[i]]       = function(code) { var d = countDepth(); code.push(() => { var p = moveUp(d); stack.push(heap[p+index]); }); };
      scope[':' + vars[i]] = function(code) { var d = countDepth(); code.push(() => { var p = moveUp(d); heap[p+index] = stack.pop(); }); };
    }
    while ( ( l = scope.readSym() ) != '}' ) scope.evalSym(l, fncode);
    oldScope.ip = scope.ip;
    scope = oldScope;
    code.push(function() {
      stack.push((function() {
        var p = hp;
        return function() {
          var old = hp;
          hp = heap.length;
          heap.push(p);
          for ( var i = 0 ; i < vars.length   ; i++ ) heap.push(stack.pop());
          for ( var i = 0 ; i < fncode.length ; i++ ) fncode[i]();
          hp = old;
      }})());
    });
  },
  switch: function(code) {
    var options = [], l;
    while ( ( l = scope.readSym() ) != 'end' ) scope.evalSym(l, options);
    for ( var i = 0 ; i < options.length-1 ; i += 2 ) { options[i](); options[i] = stack.pop(); }
    code.push(function() {
      var value = stack.pop();
      for ( var i = 0 ; i < options.length ; i += 2 ) {
        if ( value === options[i] ) {
          options[i+1]();
          return;
        }
      }
      return options[options.length-1]();
    });
  },
  // version allows execution within definition for better meta-programming
  /*
  switch2: function(code) {
    var sp = stack.length, l;
    while ( ( l = scope.readSym() ) != 'end' ) scope.evalSym(l, { push: f => f() });
    var options = stack.slice(sp, stack.length);
    stack.length = sp;
    code.push(() => {
      var value = stack.pop();
      debugger;
      for ( var i = 0 ; i < options.length ; i += 2 ) {
        if ( value === options[i] ) {
          stack.push(options[i+1]);
          return;
        }
      }
      stack.push(options[options.length-1]);
    });
  },*/
  debug:  fn(() => { debugger; }), // breaks into debugger during runtime
  print:  fn(() => { console.log(stack.pop()); }),
  if:     fn(() => { var block = stack.pop(); var cond = stack.pop(); if ( cond ) block(); }),
  ifelse: fn(() => { var fBlock = stack.pop(), tBlock = stack.pop(), cond = stack.pop(); (cond ? tBlock : fBlock)(); }),
  while:  fn(() => { var block = stack.pop(), cond = stack.pop(); while ( true ) { cond(); if ( ! stack.pop() ) break; block(); } }),
  const:  fn(() => { var sym = stack.pop(), value = stack.pop(); scope[sym] = fn(() => { stack.push(value); }); }),
  '[]WithValue': fn(() => {
    var value = stack.pop(), length = stack.pop(), a = [];
    for ( var i = 0 ; i < length ; i++ ) a[i] = value;
    stack.push(a);
  }),
  '[]WithFn': fn(() => {
    var fn = stack.pop(), length = stack.pop(), a = [];
    for ( var i = 0 ; i < length ; i++ ) { stack.push(i); fn(); a[i] = stack.pop(); }
    stack.push(a);
  }),
  '@': bfn((a, i) => a[i]),
  ':@': fn(() => { var i = stack.pop(), a = stack.pop(), v = stack.pop(); a[i] = v; }),
  '[': fn(() => { stack.push(__arrayStart__); }),
  ']': fn(() => {
    var start = stack.length-1;
    for ( ; start && stack[start] !== __arrayStart__ ; start-- );
    var a = new Array(stack.length-start-1);
    for ( var i = a.length-1 ; i >= 0 ; i-- ) a[i] = stack.pop();
    stack.pop();
    stack.push(a);
  }),
  'i[':   code => { var s = '', c; while ( (c = scope.readChar()) != ']' ) s += c; scope.eval$(s); },
  '"':    code => { var s = '', c; while ( (c = scope.readChar()) != '"' ) s += c; code.push(() => stack.push(s)); },
  '//':   () => { while ( (c = scope.readChar()) != '\n' ); },
  '/*':   () => { while ( (c = scope.readSym()) != '*/' ); },
  not:    fn(() => { stack.push( ! stack.pop()); }),
  '&':    bfn((a,b) => a && b),
  '|':    bfn((a,b) => a || b),
  '&&':   fn(() => { var aFn = stack.pop(), b = stack.pop(); if ( ! b ) stack.push(false); else aFn(); }),
  '||':   fn(() => { var aFn = stack.pop(), b = stack.pop(); if (   b ) stack.push(true);  else aFn(); }),
  mod:    bfn((a,b) => a % b),
  '=':    bfn((a,b) => a === b),
  '!=':   bfn((a,b) => a !== b),
  '<':    bfn((a,b) => a < b),
  '<=':   bfn((a,b) => a <= b),
  '>':    bfn((a,b) => a > b),
  '>=':   bfn((a,b) => a >= b),
  '+':    bfn((a,b) => a + b),
  '*':    bfn((a,b) => a * b),
  '-':    bfn((a,b) => a - b),
  '/':    bfn((a,b) => a / b),
  '^':    bfn((a,b) => Math.pow(a,b)),
  '%':    fn(() => { stack.push(stack.pop() / 100); }),
  '()':   fn(() => { var f = stack.pop(); f(); })
};

// Parser Support
scope.charAt  = bfn((s, i) => s.charAt(i));
scope.indexOf = bfn((s, p) => s.indexOf(p));
scope.len     = fn(() => { stack.push(stack.pop().length); });
scope.input_  = fn(() => { stack.push(scope.input); });
scope.ip_     = fn(() => { stack.push(scope.ip); });

// Language
scope.eval$(`
1 1 = :true        // define true
1 2 = :false       // define false
{ | } :nil         // define 'nil', like doing nil = new Object() in Java/JS
{ n | 0 n - } :neg // negate
{ start end block |
  start end <= { |
    start block ()
    start 1 + end block for ()
  } if
} :for
`);


// Tests
scope.eval$(`
// Build a Tester class to perform tests and record statistics
{ |
  0 0 { passed failed |
    { m this |
      m switch
        'score { f |
          f { | passed 1 + :passed " PASSED" } { | failed 1 + :failed " FAILED" } ifelse
        }
        'test { script answer |
          " Expect: " script "  -> " answer "  " + + + +
          script eval answer = this.score + print
        }
        'report { |
          " " print
          " Tests Run: " passed failed + + print
          "    PASSED: " passed + print
          "    FAILED: " failed + print
          " " print
        }
        { | " unknown method: " m + print }
      end ()
    }
  } ()
} :Tester

// Create an instance of Tester
Tester () :t


// A helper function for displaying section titles
{ t | " " print t print } :section


'Arithmetic section ()
" 1 1 +" 2 t.test
" 0 1 +" 1 t.test
" 2 1 -" 1 t.test
" 0 6 -" -6 t.test
" 4 2 *" 8 t.test
" 4 2 /" 2 t.test
" 10 3 mod" 1 t.test
" 2 8 ^" 256 t.test
" 15 %" 0.15 t.test
" 15 10 10 ^ *" 150000000000 t.test // scientific notation, distance from earth to sun in meters
" 5 neg ()" -5 t.test // it's inconsistent that some operators require () and others don't


'Comparators section ()
" 1 1 ="  true  t.test
" 1 2 ="  false t.test
" 1 1 !=" false t.test
" 1 2 !=" true  t.test
" 1 2 < " true  t.test
" 2 1 < " false t.test
" 2 2 <=" true  t.test
" 2 3 <=" true  t.test


'Logic section ()
" false not" true  t.test
" true not"  false t.test

" false false |"  false t.test
" false true  |"  true  t.test
" true  false |"  true  t.test
" true  true  |"  true  t.test

" false false &"  false t.test
" false true  &"  false t.test
" true  false &"  false t.test
" true  true  &"  true  t.test

" false { | false } &&"  false t.test
" false { | true }  &&"  false t.test
" true  { | false } &&"  false t.test
" true  { | true }  &&"  true  t.test

" false { | false } ||"  false t.test
" false { | true }  ||"  true  t.test
" true  { | false } ||"  true  t.test
" true  { | true }  ||"  true  t.test

" true false | true false & |" true t.test


'Functions section ()
{ a | a print } :A
4 A ()
{ b | b A () } :B
5 B ()

{ | " inline function" print } ()

{ | " Hello world!" print } :helloWorld
helloWorld ()

{ a | a a + } :double
2 double () double () print


" Functions as Parameters" section ()
{ f | " running callFiveTimes" print f f f f f i[ " compiling callFiveTimes" print ] () f () f () f () f () } :callFiveTimes
helloWorld callFiveTimes ()


" Own Variables" section ()
// a precursor to OO
1 { count |
  { | count 1 + :count count }
} () :counter

counter () print
counter () print
counter () print


'OO section ()
// Create a Lisp-like CONS operator, but use head/tail instead of car/cdr
// Is a simple class.
{ h t |
  { m |
    m switch
      'head { | h } ':head { v | v :h }
      'tail { | t } ':tail { v | v :t }
      { | }
    end ()
  }
} :cons

'car 'cdr cons () :c // construct a cons
'head c () print
'tail c () print
1 ':head c ()
2 ':tail c ()
'head c () print
'tail c () print

// Now a more featured OO system with 'this' 'super' and inheritance
{ x y r |
  { m this |
    m switch
      'class { | Ball }
      'x { | x } ':x { v | v :x }
      'y { | y } ':y { v | v :y }
      'r { | r } ':r { v | v :r }
      'toString { | x ', y ', r + + + + }
      { | " unknown method" print }
    end ()
  }
} :Ball

5 4 3 Ball () :b1
b1.x print
b1.toString print

10 19 5 Ball () :b2
b2.toString print

{ c | Ball () { super |
  { m this | m switch
    'class { | ColourBall }
    'c { | c } ':c { v | v :c }
    'toString { | super.toString ', c + + }
    { | m this super () }
  end () }
} () } :ColourBall // This would also work and be faster:   } () } 'ColourBall const

6 5 2 'red ColourBall () :b3
b3.c print
b3.toString print

7 7 1 'green b3.class () :b4
b4.toString print

/*
// The above code is the equivalent to this in a more regular syntax:

class ColourBall extends Ball {
  var c;
  ColourBall(..., c) {
    super(...);
    this.c = c;
  }
  getC() { return c; }
  setC(v) { c = v; }
  toString() { return super.toString() + ", " + c_; }
}
*/


'Recursion section ()
{ n | n 1 <= { | 1 } { | n n 1 - fact () * } ifelse } :fact
" 20 fact ()" 2432902008176640000 t.test


" Lexical Scoping" section ()
1 { a | { | a print } () } ()

" hello world"  { a | { | a print } } () :sayhello
sayhello () sayhello ()

" 3 deep"  { a | { | { | a print } } } () () ()


'Variables section ()
3 14 100 / + :PI // PI = 3.14, need to do this way until doubles are supported
PI print
PI 2 * print

1 { i |
  i print
  i 1 + :i i print
  i 1 + :i i print
  i 1 + :i i print
  i 1 + :i i print
  i 1 + :i i print
  i 1 + :i i print
  i 1 + :i i print
} ()


'Conditionals section ()
true  { | " is true"  print } if
false { | " is false" print } if

true  { | " if true" print } { | " if false" print } ifelse
false { | " if true" print } { | " if false" print } ifelse


'Eval section ()
" 1 + 2 print" eval

{ script answer |
  " Expect: " script "  -> " answer "  " + + + +
  script eval answer = + print
} :expect

" 1 2 +" 3 expect ()
" 1 2 +" 4 expect ()


'Looping section ()
1 { i |
  { | i 10 <= } { | " loop: " i + print i 1 + :i } while
} ()

1 10 { i | " for: " i + print } for ()


'Nil section ()
" nil nil =" true  t.test
" nil 5   =" false t.test


'Switch section ()
3 switch
  1 { | " one"   }
  2 { | " two"   }
  3 { | " three" }
  { | " unknown" }
end () print

{ n | n
  switch
    1 " un"
    2 " deus"
    3 " trois "
    " unknown"
  end
} :lookupNumber
2 lookupNumber () print
7 lookupNumber () print


'Const section ()
3.1415926 'PI const
" PI" 3.1415926 t.test
PI print


'Arrays section ()
10 'hello []WithValue :hellos
hellos print
" good bye" hellos 5 :@
hellos print
16 { i | 2 i ^ } []WithFn :powersOf2
powersOf2 print
powersOf2 4 @ print
[ 1 2 3 'abc " def" true false ] print

t.report
`);


scope.eval$(`
'Parsers section ()

{ str pos value |
  { m this |
    m switch
      'head { | '* str pos charAt + print str pos charAt }
      'tail { | str pos 1 + this.head PStream () }
      { | " unknown method " m + print }
    end ()
  }
} :PStream

" 01234" 3 charAt print

// Access to current input:
ip_ print
// input_ print

// Parse Combinators

{ start end c | c start >=  c end <= & } :inRange
{ start end | { ps |
  start end ps.head inRange () { | ps.tail } { | false } ifelse
} } :range

{ str | { ps | 0 { i |
  { | ps.head str i charAt = } { | ps.tail :ps  i 1 + :i } while
  str len i = { | ps } { | false } ifelse
} () } } :literal

{ parsers | { ps | 0 { i |
  { | i parsers len < { | ps parsers i @ () :ps ps } && } { | i 1 + :i } while
  parsers len i = { | ps } { | false } ifelse
} () } } :seq

{ parsers | { ps | 0 false { i ret |
  { | i parsers len < { | ps parsers i @ () :ret ret not } && } { | i 1 + :i } while
  ret
} () } } :alt

{ parser min | { ps | 0 false { i ret |
  { | ps :ret  ps parser () :ps ps } { | i 1 + :i } while
  i min >=  { | ret } { | false } ifelse
} () } } :repeat

{ parser | { ps | ps { ret |
  ps parser () :ret
  ret { | ret } { | ps } ifelse
} () } } :optional

{ str | { ps |
  str ps.head indexOf -1 = { | ps.tail } { | false } ifelse
} } :notChars


" thisthenthat0123 " 0 nil PStream () :ps

ps 'this literal () () print
'that print
ps 'that literal () () print


" Seq Parser" section ()
[ 'this literal () 'then literal () 'that literal () ] seq () :seqparser
ps seqparser () print


" Alt Parser" section ()
[ 'something literal () 'this literal () ] alt () :altparser
ps altparser () print


" Range Parser" section ()
'0 '9 range  () :rangeparser
ps rangeparser () print
'a 'z range  () :rangeparser
ps rangeparser () print


" Repeat Parser" section ()
'a 'z range () 1 repeat () :repeatparser
ps repeatparser () print


" Optional Parser" section ()
'this print
ps 'this literal () optional () () print
'that print
ps 'that literal () optional () () print


" NotChars Parser" section ()
ps " 0123456789" notChars () 0 repeat () () print


'Grammar section ()
{ parser | { this | parser } } :;
{ name | { this | name this this () } } :sym

{ |
  { m this |
    m switch
//      'parse  { | this.start }
//      'start  { | this.number }
//      'number { | digit } ; 1 repeat () ;
      'digit  '0 '9 range () debug ;
      { | " unknown method " m + print }
    end ()
  }
} :FormulaParser

'a print
" 1+2*3 " 0 nil PStream () :ps
'b print
FormulaParser () :formulaparser
'c print
ps formulaparser.digit () print
'd print

`);


/*
TODO:
  - maybe switch | symbol to / since it's faster to type and looks more like lambda?
  - make string function naming more consistent
  - add OO 'call' function
  - have functions auto-call and use quoting to reference without calling?
  - return statement & recursive calls
  - optimize forward references
  - symbols
  - function return values?
  - readSym() and readChar() should be callable from scripts
  - make eval() be the real method and eval$ call it
  - alloc?
  - don't put heap in an array to allow for JS GC?
  - Add in-line cache for method lookups

a = { x: a b c | 234 x:ret }

  {
     expr if: {
       a map { }
     } else: {  }
     map { }

  }
*/
