var stack = [], heap = [], hp;
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
  eval: function(code) { code.push(function() { scope.eval$(stack.pop()); }); },
  evalSym: function(line, code) {
    var sym = scope[line];
    if ( sym ) { sym(code); }
    else if ( line.startsWith(':') ) {
      var sym = line.substring(1);
      code.push(function() { var value = stack.pop(); scope[sym] = function(code) { code.push(function() { stack.push(value); }); } });
    } else if ( line.charAt(0) >= '0' && line.charAt(0) <= '9' || ( line.charAt(0) == '-' && line.length > 1 ) ) {
      code.push(function() { stack.push(Number.parseInt(line)); });
    } else if ( line.startsWith("'") ) {
      var s = line.substring(1);
      code.push(function() { stack.push(s); });
    } else {
      console.log('Unknown Symbol or Forward Reference:', line, ' at: ', scope.input.substring(scope.ip, scope.ip+40).replaceAll('\n', ''), ' ...');
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
  debug:  fn(function() { debugger; }), // breaks into debugger during runtime
  print:  fn(function() { console.log(stack.pop()); }),
  not:    fn(function() { stack.push( ! stack.pop()); }),
  and:    fn(function() { stack.push(stack.pop() &&  stack.pop()); }),
  or:     fn(function() { stack.push(stack.pop() ||  stack.pop()); }),
  mod:    fn(function() { var a = stack.pop(), b = stack.pop(); stack.push(b % a); }),
  if:     fn(function() { var block = stack.pop(); var cond = stack.pop(); if ( cond ) block(); }),
  ifelse: fn(function() { var fBlock = stack.pop(), tBlock = stack.pop(), cond = stack.pop(); (cond ? tBlock : fBlock)(); }),
  while : fn(function() { var block = stack.pop(), cond = stack.pop(); while ( true ) { cond(); if ( ! stack.pop() ) break; block(); } }),
  'i[':   function(code) { var s = '', c; while ( (c = scope.readChar()) != ']' ) s += c; scope.eval$(s); },
  '"':    function(code) { var s = '', c; while ( (c = scope.readChar()) != '"' ) s += c; code.push(function() { stack.push(s); }); },
  '//':   function() { while ( (c = scope.readChar()) != '\n' ); },
  '/*':   function() { while ( (c = scope.readSym()) != '*/' ); },
  '=':    fn(function() { stack.push(stack.pop() === stack.pop()); }),
  '!=':   fn(function() { stack.push(stack.pop() !== stack.pop()); }),
  '<':    fn(function() { stack.push(stack.pop() >   stack.pop()); }),
  '<=':   fn(function() { stack.push(stack.pop() >=  stack.pop()); }),
  '>':    fn(function() { stack.push(stack.pop() <   stack.pop()); }),
  '>=':   fn(function() { stack.push(stack.pop() <=  stack.pop()); }),
  '+':    fn(function() { var a = stack.pop(), b =   stack.pop(); stack.push(b + a); }),
  '*':    fn(function() { stack.push(stack.pop() *   stack.pop()); }),
  '-':    fn(function() { var a = stack.pop(), b =   stack.pop(); stack.push(b - a); }),
  '/':    fn(function() { var a = stack.pop(), b =   stack.pop(); stack.push(b / a); }),
  '^':    fn(function() { var a = stack.pop(), b =   stack.pop(); stack.push(Math.pow(b,a)); }),
  '%':    fn(function() { stack.push(stack.pop() / 100); }),
  '()':   fn(function() { var f = stack.pop(); f(); })
};

// Experiments
scope.eval$(`
  'starting print
  { a | a print } :A
  4 A ()
  { b | b A () } :B
  5 B ()

  { x_ y_ r_ |
    { m |
      m switch
        'x { | x_ } ':x { v | v :x_ }
        'y { | y_ } ':y { v | v :y_ }
        'r { | r_ } ':r { v | v :r_ }
        'toString { | x_ " ," y_ " ," r_ + + + + }
        { | " unknown method" print }
      end ()
    }
  } :Ball

  5 4 3 Ball () :b1
  'x b1 () print
  'toString b1 () print

  10 19 5 Ball () :b2
  'toString b2 () print

  { c_ |
    Ball ()
    { super |
      { m |
        m switch
          'c { | c_ } ':c { v | v :c_ }
          'toString { | 'toString super () ', ' + c_ + + }
          { | m super () }
        end ()
      }
    } ()
  } :ColourBall

  6 5 2 'red ColourBall () :b3
  'c b3 () print
  'toString b3 () print

  'end print
  `);

  scope.eval$(`
{ n | n 1 <= { | 1 } { | n n 1 - fact () * } ifelse } :fact
" 20 factorial: " 20 fact () + print

" Lexical Scoping" print
1 { a | { | a print } () } ()
" hello world"  { a | { | a print } } () :sayhello
sayhello () sayhello ()
" 3 deep"  { a | { | { | a print } } } () () ()
`);

// Language
scope.eval$(`
1 1 = :true        // define true
1 2 = :false       // define false
{ n | 0 n - } :neg // negate
`);

// Tests
scope.eval$(`
// A comment
" Starting..." print

" Arithmetic" print
1 2 + print
2 1 - print
0 6 - print
4 2 * print
4 2 / print
10 3 mod print
2 8 ^ print
15 % print
15 10 10 ^ * print // scientific notation, distance from earth to sun in meters
5 neg () print // it's inconsistent that some operators require () and others don't

" Comparison Operators" print
1 1 =  print
1 2 =  print
1 1 != print
1 2 != print
1 2 <  print
2 1 <  print
2 2 <= print
2 3 <= print

" Boolean Values" print
true  print
false print

" Logical Operators" print
true  not print
false not print
true  true  and print
true  false and print
false false or  print
false true  or  print

" sample string" print
3 14 100 / + :PI // PI = 3.14, need to do this way until doubles are supported
PI print
PI 2 * print

{ | " inline function" print } ()

{ | " Hello world!" print } :helloWorld
helloWorld ()

{ a | a a + } :double
2 double () double () print

" Functions as parameters" print
{ f | " start" print f f f f f i[ " compile callFiveTimes" print ] () f () f () f () f () } :callFiveTimes
helloWorld print
helloWorld callFiveTimes ()

" Conditionals" print
true  { | " is true"  print } if
false { | " is false" print } if

true  { | " if true" print } { | " if false" print } ifelse
false { | " if true" print } { | " if false" print } ifelse

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

" Eval" print
" 1 + 2 print" eval

{ script answer |
  " Expect: " script "  -> " answer "  " + + + +
  script eval answer = + print
} :expect

" 1 2 +" 3 expect ()
" 1 2 +" 4 expect ()

1 { i |
  { | i 10 <= } { | " loop: " i + print i 1 + :i } while
} ()

{ start end block |
  start end <= { |
    start block ()
    start 1 + end block for ()
  } if
} :for

1 10 { i | " for: " i + print } for ()

" OO" print
// Create a Lisp-like CONS operator, but use head/tail instead of car/cdr
// Is a simple class.
{ h t |
  { m |
    m switch
      'head { | h }
      'tail { | t }
      ':head { v | v :h }
      ':tail { v | v :t }
      { | }
    end ()
  }
} :cons

" car" " cdr" cons () :c // construct a cons
'head c () print
'tail c () print
1 ':head c ()
2 ':tail c ()
'head c () print
'tail c () print


{ | } :nil // define 'nil', like doing nil = new Object() in Java/JS
nil nil = print
nil 5 = print

" Switch" print
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

" Done." print
`);

scope.eval$(`
" Own Variables" print
1 { count |
{ | count 1 + :count count }
} () :counter
counter () print
counter () print
counter () print
`);

/*
TODO:
  - return statement
  - classes (as closures?)
  - symbols
  - function return values
  - local variables (as functions?)
  - constants?
  - readSym() and readChar() should be callable from scripts
  - make eval() be the real method and eval$ call it

  { x: a b c | 234 x:ret }
*/
