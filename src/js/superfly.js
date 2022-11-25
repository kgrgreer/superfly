var stack = [], heap = [], hp;
function isSpace(c) { return c === ' ' || c === '\t' || c === '\n' }
function fn(f) { return function(code) { code.push(f); } }
var scope = {
  readChar: function() { return this.ip < this.input.length ? this.input.charAt(this.ip++) : undefined; },
  read: function() {
    var sym = '', c;
    while ( c = this.readChar() ) {
      if ( isSpace(c) ) {
        if ( sym ) break; else continue;
      }
      sym += c;
    }
    return sym;
  },
  eval: function(code) {
    var oldInput = scope.input, oldIp = scope.ip;
    scope.input = code || stack.pop();
    scope.ip    = 0;
    for ( var sym ; sym = scope.read() ; )
      scope.evalSym(sym, { push: function(fn) { fn(); } });
    scope.input = oldInput;
    scope.ip    = oldIp
  },
  evalSym: function(line, code) {
    var sym = scope[line];
    if ( sym ) { sym(code); }
    else if ( line.startsWith(':') ) {
      var sym   = line.substring(1), value = stack.pop();
      code.push(function() { scope[sym] = function() { stack.push(value); }; });
    } else if ( line.charAt(0) >= '0' && line.charAt(0) <= '9' || ( line.charAt(0) == '-' && line.length > 1 ) ) {
      code.push(function() { stack.push(Number.parseInt(line)); });
    } else {
      console.log('Unknown Symbol:', line, ' at: ', scope.input.substring(scope.ip, scope.ip+40).replaceAll('\n', ''), ' ...');
    }
  },
  '"':    function(code) {
    var s = '', c;
    while ( (c = scope.readChar()) != '"' ) s += c;
    code.push(function() { stack.push(s); });
  },
  '{':    function(code) {
    var l, oldScope = scope, vars = [], fncode = [];
    scope = Object.create(scope);

    // read var names
    while ( ( l = scope.read() ) != '|' ) vars.push(l);

    // define variable accessors
    for ( let i = 0 ; i < vars.length ; i++ ) {
      let index = vars.length-i-1;
      // TODO: should be immediate to figure out the depth
      scope[vars[i]]       = fn(function() { stack.push(heap[hp+index]); });
      scope[':' + vars[i]] = fn(function() { heap[hp+index] = stack.pop(); });
    }

    while ( ( l = scope.read() ) != '}' ) scope.evalSym(l, fncode);

    oldScope.ip = scope.ip;
    scope = oldScope;

    // create the function
    code.push(function() {
      stack.push(function() {
        var old = hp;
        hp = heap.length;
        for ( var i = 0 ; i < vars.length   ; i++ ) heap.push(stack.pop());
        for ( var i = 0 ; i < fncode.length ; i++ ) fncode[i]();
        hp = old;
      });
    });
  },
  '//':   function() { while ( (c = scope.readChar()) != '\n' ); },
  '/*':   function() { while ( (c = scope.read()) != '*/' ); },
  debugImmediate: function() { debugger; }, // breaks into debugger during compilation
  debug:  fn(function() { debugger; }), // breaks into debugger during runtime
  print:  fn(function() { console.log(stack.pop()); }),
  not:    fn(function() { stack.push( ! stack.pop()); }),
  and:    fn(function() { stack.push(stack.pop() &&  stack.pop()); }),
  or:     fn(function() { stack.push(stack.pop() ||  stack.pop()); }),
  mod:    fn(function() { var a = stack.pop(), b = stack.pop(); stack.push(b % a); }),
  if:     fn(function() { var block = stack.pop(); var cond = stack.pop(); if ( cond ) block(); }),
  ifelse: fn(function() { var fBlock = stack.pop(), tBlock = stack.pop(), cond = stack.pop(); (cond ? tBlock : fBlock)(); }),
  '=':    fn(function() { stack.push(stack.pop() === stack.pop()); }),
  '!=':   fn(function() { stack.push(stack.pop() !== stack.pop()); }),
  '<':    fn(function() { stack.push(stack.pop() >=  stack.pop()); }),
  '<=':   fn(function() { stack.push(stack.pop() >   stack.pop()); }),
  '>':    fn(function() { stack.push(stack.pop() <=  stack.pop()); }),
  '>=':   fn(function() { stack.push(stack.pop() <   stack.pop()); }),
  '+':    fn(function() { var a = stack.pop(), b = stack.pop(); stack.push(b + a); }),
  '*':    fn(function() { stack.push(stack.pop() *   stack.pop()); }),
  '-':    fn(function() { var a = stack.pop(), b = stack.pop(); stack.push(b - a); }),
  '/':    fn(function() { var a = stack.pop(), b = stack.pop(); stack.push(b / a); }),
  '^':    fn(function() { var a = stack.pop(), b = stack.pop(); stack.push(Math.pow(b,a)); }),
  '%':    fn(function() { stack.push(stack.pop() / 100); }),
  '()':   fn(function() { var f = stack.pop(); f(); })
};

scope.eval(`
" start" print
1 { a | { | a print } () } ()
" end" print
`);

// Language
scope.eval(`
1 1 = :true        // define true
1 2 = :false       // define false
{ n | 0 n - } :neg // negate
`);

// Tests
scope.eval(`
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
{ f | " start" print f f f f f debug () f () f () f () f () } :callFiveTimes
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

/*
 TODO: fix, needs closure support to work
{ start end block |
  start end < { |
    start block ()
    start 1 + end block for ()
  } if
} :for

1 10 { i | i print } for ()
*/

" Done." print
`);

scope.eval(`
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
  - keep track of function depth and follow back heap pointers
  - closures
  - classes (as closures?)
  - symbols
  - symbol table
  - stack frames
  - function return values
  - local variables (as functions?)
  - constants?
  - have eval take args from stack and be callable from scripts
  - read() and readChar() should be callable from scripts
  - distinguish between immediate and non-immediate words?
*/