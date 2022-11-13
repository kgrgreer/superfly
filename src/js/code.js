console.log('Start');

var input = `
5
4
+
print
"sample string
print
`;

var stack = [];
var globals = {
  read: (function() {
    var lines = input.split('\n');
    var ptr = 0;
    return function() {
      return ptr < lines.length ? lines[ptr++] : undefined;
    };
  })(),
  eval: function(line) {
    if ( line.startsWith('"') ) {
      stack.push(line.substring(1));
    } else if ( line == '' ) {
    } else if ( line.charAt(0) >= '0' && line.charAt(0) <= '9' || line.charAt(0) == '-' ) {
      stack.push(Number.parseInt(line));
    } else {
      var sym = globals[line];
      if ( sym ) {
        sym();
      } else {
        console.log('Unknown Symbol:', line);
      }
    }
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
  '+': function() {
    stack.push(stack.pop() + stack.pop());
  }
};

var lines = input.split('\n');


var line;
while ( true ) {
  line = globals.read();
  if ( line === undefined ) break;
  globals.eval(line);
}
