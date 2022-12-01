var stack = [], heap = [], hp, __arrayStart__ = '__arrayStart__';
function fn(f) { return code => code.push(f); }
var scope = {
  readChar: function() { return this.ip < this.input.length ? this.input.charAt(this.ip++) : undefined; },
  readSym: function() {
    var sym = '', c;
    while ( c = this.readChar() ) {
      if ( /\s/.test(c) ) { if ( sym ) break; else continue; }
      sym += c;
    }
    return sym;
  },
  eval$: function(src) {
    var oldInput = scope.input, oldIp = scope.ip;
    scope.input = src;
    scope.ip    = 0;
    for ( var sym ; sym = scope.readSym() ; )
      scope.evalSym(sym, { push: f => f() });
    scope.input = oldInput;
    scope.ip    = oldIp
  },
  eval: code => { code.push(function() { scope.eval$(stack.pop()); }); },
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
      console.log('Unknown Symbol or Forward Reference: "' + line + '" at:', scope.input.substring(scope.ip, scope.ip+40).replaceAll('\n', '\\n'), ' ...');
      code.push(function() { scope[line]({ push: function(f) { f(); }})});
    }
  },
  '{':    function(code) {
    var l, oldScope = scope, vars = [], fncode = [];
    var curScope = scope = Object.create(scope);
    while ( ( l = scope.readSym() ) != '|' ) vars.push(l); // read var names
    function countDepth() { var d = 0, s = scope; while ( s !== curScope ) { s = s.__proto__; d++; } return d; }
    function moveUp(d) { var p = hp; for ( var i = 0 ; i < d ; i++ ) p = heap[p]; return p; }
    for ( let i = 0 ; i < vars.length ; i++ ) {
      let index = vars.length-i;
      scope[vars[i]]       = function(code) { var d = countDepth(); code.push(function() { var p = moveUp(d); stack.push(heap[p+index]); }); };
      scope[':' + vars[i]] = function(code) { var d = countDepth(); code.push(function() { var p = moveUp(d); heap[p+index] = stack.pop(); }); };
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
    var options = [], l, def, options = [];
    while ( ( l = scope.readSym() ) != 'end' ) {
      scope.evalSym(l, options);
    }

    code.push(function() {
      var value = stack.pop();
      for ( var i = 0 ; i < options.length ; i += 2 ) {
        options[i]();
        if ( value === stack.pop() ) {
          options[i+1]();
          return;
        }
      }
      return options[options.length-1]();
    });
  },
  debug:  fn(() => { debugger; }), // breaks into debugger during runtime
  print:  fn(() => { console.log(stack.pop()); }),
  not:    fn(() => { stack.push( ! stack.pop()); }),
  and:    fn(() => { var a = stack.pop(), b = stack.pop(); stack.push(a && b); }),
  or:     fn(() => { var a = stack.pop(), b = stack.pop(); stack.push(a || b); }),
  mod:    fn(() => { var a = stack.pop(), b = stack.pop(); stack.push(b % a); }),
  if:     fn(() => { var block = stack.pop(); var cond = stack.pop(); if ( cond ) block(); }),
  ifelse: fn(() => { var fBlock = stack.pop(), tBlock = stack.pop(), cond = stack.pop(); (cond ? tBlock : fBlock)(); }),
  while:  fn(() => { var block = stack.pop(), cond = stack.pop(); while ( true ) { cond(); if ( ! stack.pop() ) break; block(); } }),
  const:  function(code) { code.push(function() {
    var sym = stack.pop(), value = stack.pop();
    scope[sym] = fn(() => { stack.push(value); });
  });},
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
  '@': fn(() => {
    var i = stack.pop(), a = stack.pop();
    stack.push(a[i]);
  }),
  ':@': fn(() => {
    var i = stack.pop(), a = stack.pop(), v = stack.pop();
    a[i] = v;
  }),
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
  '"':    code => { var s = '', c; while ( (c = scope.readChar()) != '"' ) s += c; code.push(function() { stack.push(s); }); },
  '//':   () => { while ( (c = scope.readChar()) != '\n' ); },
  '/*':   () => { while ( (c = scope.readSym()) != '*/' ); },
  '=':    fn(() => { stack.push(stack.pop() === stack.pop()); }),
  '!=':   fn(() => { stack.push(stack.pop() !== stack.pop()); }),
  '<':    fn(() => { stack.push(stack.pop() >   stack.pop()); }),
  '<=':   fn(() => { stack.push(stack.pop() >=  stack.pop()); }),
  '>':    fn(() => { stack.push(stack.pop() <   stack.pop()); }),
  '>=':   fn(() => { stack.push(stack.pop() <=  stack.pop()); }),
  '+':    fn(() => { var a = stack.pop(), b =   stack.pop(); stack.push(b + a); }),
  '*':    fn(() => { stack.push(stack.pop() *   stack.pop()); }),
  '-':    fn(() => { var a = stack.pop(), b =   stack.pop(); stack.push(b - a); }),
  '/':    fn(() => { var a = stack.pop(), b =   stack.pop(); stack.push(b / a); }),
  '^':    fn(() => { var a = stack.pop(), b =   stack.pop(); stack.push(Math.pow(b,a)); }),
  '%':    fn(() => { stack.push(stack.pop() / 100); }),
  '()':   fn(() => { var f = stack.pop(); f(); })
};

// Parser Support
scope.charAt = fn(() => { var i = stack.pop(), s = stack.pop(); stack.push(s.charAt(i)); });
scope.len    = fn(() => { stack.push(stack.pop().length); });
scope.input_ = fn(() => { stack.push(scope.input); });
scope.ip_    = fn(() => { stack.push(scope.ip); });

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

" false false or"  false t.test
" false true  or"  true  t.test
" true  false or"  true  t.test
" true  true  or"  true  t.test

" false false and"  false t.test
" false true  and"  false t.test
" true  false and"  false t.test
" true  true  and"  true  t.test

" true false or true false and or" true t.test


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
    1 " one"
    2 " two"
    3 " three"
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
      'head { | str pos charAt }
      'tail { | str pos 1 + this.head PStream () }
      { | " unknown method " m + print }
    end ()
  }
} :PStream

" 01234" 3 charAt print

ip_ print
// input_ print

{ str | { ps |
  0 { i |
    { | ps.head str i charAt = } { | ps.tail :ps  i 1 + :i } while
    str len i =
  } ()
} } :literal

" this " 0 nil PStream () :ps

'a print
'this print
ps " this" literal () () print
'that print
ps " that" literal () () print

/*
" this
is a test
is a test
is a test
is a test
of an input text" 0 nil PStream () :ps
ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
ps.tail :ps ps.head print
*/
`);


/*
TODO:
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
