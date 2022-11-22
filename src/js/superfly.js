var stack = [], sp = 0 /* stack pointer */;
function isSpace(c) { return c === ' ' || c === '\t' || c === '\n' }
var scope = {
  debugger: function() { debugger; },
  readChar: function() { return scope.ip < scope.input.length ? scope.input.charAt(scope.ip++) : undefined; },
  read: function() {
    var sym = '', c;
    while ( c = this.readChar() ) {
      if ( isSpace(c) ) {
        if ( sym ) break;
        continue;
      }
      sym += c;
    }
    return sym;
  },
  eval: function(code) {
    var oldInput = scope.input, oldIp = scope.ip;
    scope.input = code || stack.pop();
    scope.ip    = 0;
    var sym;
    while ( sym = scope.read() ) {
    //  console.log('---> ', sym);
      var fn = scope.evalSym(sym);
      fn && fn();
    }
    scope.input = oldInput;
    scope.ip    = oldIp
  },
  evalSym: function(line) {
    var sym = scope[line];
    if ( sym ) return sym;
    if ( line.startsWith(':') ) {
      var sym   = line.substring(1);
      var value = stack.pop();
      return function() { scope[sym] = function() { stack.push(value); }; };
    }
    // TODO: define in language
    if ( line === '//' ) {
      while ( (c = scope.readChar()) != '\n' );
      return;
    }
    // TODO: define in language
    if ( line === '/*' ) {
      while ( (c = scope.read()) != '*/' );
      return;
    }
    if ( line === '"' ) {
      var s = '', c;
      while ( (c = scope.readChar()) != '"' ) s += c;
      return function() { stack.push(s); };
    }
    if ( line.charAt(0) >= '0' && line.charAt(0) <= '9' || ( line.charAt(0) == '-' && line.length > 1 ) ) {
      return function() { stack.push(Number.parseInt(line)); }
    }
    console.log('Unknown Symbol:', line, ' at: "', scope.input.substring(scope.ip, scope.ip+40), '"');
  },
  print: function() { console.log(stack.pop()); },
  '{': function() {
    var l, oldScope = scope, vars = [], code = [];

    scope = Object.create(scope);
    // read var names
    while ( ( l = scope.read() ) != '|' ) vars.push(l);

    // define variable accessors
    for ( let i = 0 ; i < vars.length ; i++ ) {
      scope[vars[i]]       = function() { stack.push(stack[sp-vars.length+i+1]); };
      scope[':' + vars[i]] = function() { stack[sp-vars.length+i+1] = stack.pop(); };
    }

    // read function body and add to code
    while ( ( l = scope.read() ) != '}' )  code.push(scope.evalSym(l));

    // create the function
    stack.push(function() {
      var oldSp = sp;
      sp = stack.length-1;
      for ( var i = 0 ; i < code.length ; i++ ) code[i]();
      sp = oldSp;
    });

    oldScope.ip = scope.ip;
    scope = oldScope;
  },
  'not': function() { stack.push( ! stack.pop()); },
  'and': function() { stack.push(stack.pop() &&  stack.pop()); },
  'or':  function() { stack.push(stack.pop() ||  stack.pop()); },
  '=':   function() { stack.push(stack.pop() === stack.pop()); },
  '!=':  function() { stack.push(stack.pop() !== stack.pop()); },
  '<':   function() { stack.push(stack.pop() >=  stack.pop()); },
  '<=':  function() { stack.push(stack.pop() >   stack.pop()); },
  '>':   function() { stack.push(stack.pop() <=  stack.pop()); },
  '>=':  function() { stack.push(stack.pop() <   stack.pop()); },
  '+':   function() { var a = stack.pop(), b = stack.pop(); stack.push(b + a); },
  '*':   function() { stack.push(stack.pop() *   stack.pop()); },
  '-':   function() { var a = stack.pop(), b = stack.pop(); stack.push(b - a); },
  '/':   function() { var a = stack.pop(), b = stack.pop(); stack.push(b / a); },
  '^':   function() { var a = stack.pop(), b = stack.pop(); stack.push(Math.pow(b,a)); },
  'mod': function() { var a = stack.pop(), b = stack.pop(); stack.push(b % a); },
  'if':  function() { var block = stack.pop(); var cond = stack.pop(); if ( cond ) block(); },
  'ifelse': function() { var fBlock = stack.pop(), tBlock = stack.pop(), cond = stack.pop(); (cond ? tBlock : fBlock)(); },
  '()':  function() { var fn = stack.pop(); fn(); }
};

// Language
scope.eval(`
1 1 = :true
1 2 = :false
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
{ f | f () f () f () f () f () } :callFiveTimes
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



/*
TODO:
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
*/
