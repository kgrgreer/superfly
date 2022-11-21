/*
TODO:
  - named function parameters
  - classes
  - symbols
  - symbol table
  - stack frames
  - function return values
  - local variables (as functions?)
  - constants

Ideas:
  - make each used frame be hidden variable

{ x y | x y + }:add
4 5 add ()
*/

var input = `
// A comment
"Starting...
print
40
2
+
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
4
{
a
|
  a
  a
  +
}
()
print
"Done.
print
`;

var stack = [];
var sp;
var global = {
  debugger: function() {
    debugger;
  },
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
    if ( line.charAt(0) >= '0' && line.charAt(0) <= '9' || line.charAt(0) == '-' ) {
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
    global = Object.create(global);
    var vars = [];
    var a = [];
    while ( ( l = global.read() ) != '|' ) {
      vars.push(l);
    }
    for ( var i = 0 ; i < vars.length ; i++ ) {
      global[vars[i]] = function() { stack.push(stack[sp-vars.length+i]); };
    }
    while ( (  l = global.read() ) != '}' ) {
      a.push(global.eval(l));
    }
    stack.push(function() {
      sp = stack.length-1;
      for ( var i = 0 ; i < a.length ; i++ ) a[i]();
    });
    global = oldGlobal;
  },
  '+': function() {
    stack.push(stack.pop() + stack.pop());
  },
  '*': function() {
    stack.push(stack.pop() * stack.pop());
  },
  '()': function() {
    (stack.pop())();
  }
};

var line;
while ( true ) {
  line = global.read();
  // console.log('line >>> ', line);
  if ( line === undefined ) break;
  var fn = global.eval(line);
  // console.log('fn >>> ', fn);
  if ( typeof fn === 'function' )
    fn();
  // console.log('stack >>> ', stack);
}
