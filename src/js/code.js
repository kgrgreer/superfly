console.log('Start');

var stack = [];
var globals = {
  print: function() {
    console.log(stack.pop());
  },
  '+': function() {
    stack.push(stack.pop(), stack.pop());
  }
};

var input = `
5
4
+
print
"sample string
print
`;

var lines = input.split('\n');

function eval(line) {
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
}

for ( var i = 0 ; i < lines.length ; i++ ) {
  var line = lines[i];
  eval(line);
}
