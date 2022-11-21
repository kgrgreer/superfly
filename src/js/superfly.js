/*
TODO:
  - closures
  - update local variables
  - classes
  - symbols
  - symbol table
  - stack frames
  - function return values
  - local variables (as functions?)
  - constants?

*/

var input = `
1
1
=
:true

1
2
=
:false


// A comment
"Starting...
print

"Arithmetic
print
1
2
+
print
2
1
-
print
0
6
-
print
4
2
*
print
4
2
/
print

"Comparison Operators
print
1
1
=
print
1
2
=
print
1
1
!=
print
1
2
!=
print
1
2
<
print
2
1
<
print
2
2
<=
print
2
3
<=
print

"Boolean Values
print
true
print
false
print

"Logical Operators
print
true
not
print

false
not
print

true
true
and
print

true
false
and
print

false
false
or
print

false
true
or
print

"sample string
print

3
:PI
PI
print
PI
2
*
print

{
  |
  "inline function
  print
}
()

{
  |
  "Hello world!"
  print
}
:helloWorld
helloWorld
()

{
  a
|
  a
  a
  +
}
:double
2
double
()
double
()
print

"Functions as parameters
print
{
  f
  |
  f
  ()
  f
  ()
  f
  ()
  f
  ()
  f
  ()
}
:callFiveTimes
helloWorld
callFiveTimes
()

"Conditionals
print
true
{
|
"true true
print
}
if

false
{
|
"false false
print
}
if

true
{
|
"if true
print
}
{
|
"if false
print
}
ifelse

false
{
|
"if true
print
}
{
|
"if false
print
}
ifelse

"Done.
print
`;

var stack = [], sp;
var global = {
  debugger: function() { debugger; },
  read: (function() {
    var lines = input.split('\n').map(l => l.replace(/^\s+/, ''));
    var ptr = 0;
    return function() {
      return ptr < lines.length ? lines[ptr++] : undefined;
    };
  })(),
  eval: function(line) {
    if ( line == '' || line.startsWith('//') ) {
      return;
    }
    if ( line.startsWith('"') ) {
      var str = line.substring(1);
      return function() { return stack.push(str); };
    }
    if ( line.startsWith(':') ) {
      var sym   = line.substring(1);
      var value = stack.pop();
      return function() { global[sym] = function() { stack.push(value); }; };
    }
    if ( line.charAt(0) >= '0' && line.charAt(0) <= '9' || ( line.charAt(0) == '-' && line.length > 1 ) ) {
      return function() { stack.push(Number.parseInt(line)); }
    }
    var sym = global[line];
    if ( sym ) {
      return function() { sym(); }
    }
    console.log('Unknown Symbol:', line);
  },
  Int: function(sym) {
    return {
      '+': function() {
        stack.push(stack.pop() + stack.pop());
      }
    }[sym];
  },
  print: function() {
    console.log(stack.pop());
  },
  '{': function() {
    var l;
    var oldGlobal = global;
    var vars      = []; // function parameter names
    var code      = []; // function's code

    global = Object.create(global);

    // read var names
    while ( ( l = global.read() ) != '|' ) {
      vars.push(l);
    }

    // define variable accessors
    for ( var i = 0 ; i < vars.length ; i++ ) {
      global[vars[i]] = function() { stack.push(stack[sp-vars.length+i]); };
    }

    // read function body and add to code
    while ( ( l = global.read() ) != '}' ) {
      code.push(global.eval(l));
    }

    // create the function
    stack.push(function() {
      sp = stack.length-1;
      for ( var i = 0 ; i < code.length ; i++ ) code[i]();
    });

    global = oldGlobal;
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
  '+':   function() { stack.push(stack.pop() +   stack.pop()); },
  '*':   function() { stack.push(stack.pop() *   stack.pop()); },
  '-':   function() { var a = stack.pop(), b = stack.pop(); stack.push(b - a); },
  '/':   function() { var a = stack.pop(), b = stack.pop(); stack.push(b / a); },
  'if':  function() { var block = stack.pop(); var cond = stack.pop(); if ( cond ) block(); },
  'ifelse': function() { var fBlock = stack.pop(), tBlock = stack.pop(), cond = stack.pop(); (cond ? tBlock : fBlock)(); },
  '()':  function() { (stack.pop())(); }
};

var line;
while ( true ) {
  line = global.read();
  if ( line === undefined ) break;
  var fn = global.eval(line);
  if ( typeof fn === 'function' )
    fn();
}
