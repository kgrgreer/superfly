/*
TODO:
  - named function parameters
  - classes
  - add assignment
  - remove name from function definition and combine with assignment
*/
var input = `
"Starting...
print
40
2
+
print
"sample string
print
:
helloWorld
"Hello world!
print
;
helloWorld
"Done.
print
`;

var stack = [];
var global = {
  debugger: function() {
    debugger;
  },
  read: (function() {
    var lines = input.split('\n');
    var ptr = 0;
    return function() {
      return ptr < lines.length ? lines[ptr++] : undefined;
    };
  })(),
  eval: function(line) {
    if ( line.startsWith('"') ) {
      var str = line.substring(1);
      return function() { return stack.push(str); };
    }
    if ( line == '' ) {
      return;
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
  ':': function() {
    var name = global.read();
    var l;
    var a = [];
    while ( (  l = global.read() ) != ';' ) {
      a.push(global.eval(l));
    }
    global[name] = function() {
      for ( var i = 0 ; i < a.length ; i++ ) a[i]();
    }
    console.log('defining', name);
  },
  '+': function() {
    stack.push(stack.pop() + stack.pop());
  }
};

var line;
while ( true ) {
  line = global.read();
  if ( line === undefined ) break;
  var fn = global.eval(line);
  if ( typeof fn === 'function' )
    fn();
}
