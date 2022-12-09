var stack = [], heap = [], hp, __arrayStart__ = '__arrayStart__', __switchStart__ = '__switchStart__', outerCode;
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
      // TODO: add an in-ilne cache here when class can be determined cheaply
      var [obj, meth] = line.split('.');
      // TODO: The next five lines could be combined into one function: o m o () ()
      this.evalSym(obj, code);
      code.push(function() { stack.push(meth); });
      this.evalSym(obj, code);
      this.evalSym('()', code);
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
    var start = scope.ip, oldScope = scope, vars = [], fncode = [];
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
    var src = scope.input.substring(start-2, scope.ip-1);
    code.push(function() {
      stack.push((function() {
        var p = hp;
        var f = function() {
          var old = hp;
          hp = heap.length;
          heap.push(p);
          for ( var i = 0 ; i < vars.length   ; i++ ) heap.push(stack.pop());
          for ( var i = 0 ; i < fncode.length ; i++ ) fncode[i]();
          hp = old;
        };
        f.toString = function() { return src; }
        return f;
      })());
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
  debugger:fn(() => { debugger; }),
  print:   fn(() => { console.log('' + stack.pop()); }),
  if:      fn(() => { var block = stack.pop(); var cond = stack.pop(); if ( cond ) block(); }),
  ifelse:  fn(() => { var fBlock = stack.pop(), tBlock = stack.pop(), cond = stack.pop(); (cond ? tBlock : fBlock)(); }),
  while:   fn(() => { var block = stack.pop(), cond = stack.pop(); while ( true ) { cond(); if ( ! stack.pop() ) break; block(); } }),
  const:   fn(() => { var sym = stack.pop(), value = stack.pop(); scope[sym] = fn(() => { stack.push(value); }); }),
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
  'i[':   code => { outerCode = code; var s = '', c; while ( (c = scope.readChar()) != ']' ) s += c; scope.eval$(s); },
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
  '+':    bfn((a,b) => { return a + b }), // Should be a different concat for strings
  '*':    bfn((a,b) => a * b),
  '-':    bfn((a,b) => a - b),
  '/':    bfn((a,b) => a / b),
  '^':    bfn((a,b) => Math.pow(a,b)),
  '%':    fn(() => { stack.push(stack.pop() / 100); }),
  '()':   fn(() => { var f = stack.pop(); /*console.log('running: ', f.toString());*/ f(); })
};

// Parser Support
scope['string?'] = fn(() => { stack.push(typeof stack.pop() === 'string'); });
scope['array?']  = fn(() => { stack.push(Array.isArray(stack.pop())); });
scope.charAt     = bfn((s, i) => s.charAt(i));
scope.indexOf    = bfn((s, p) => s.indexOf(p));
scope.len        = fn(() => { stack.push(stack.pop().length); });
scope.input_     = fn(() => { stack.push(scope.input); });
scope.ip_        = fn(() => { stack.push(scope.ip); });

scope.emit = function() { var v = stack.pop(); outerCode.push(() => stack.push(v)); };


// Language
scope.eval$(`
1 1 = :true        // define true
1 2 = :false       // define false
{ | } :nil         // define 'nil', like doing nil = new Object() in Java/JS
{ n | 0 n - } :neg // negate

{ start end block |
  { | start end <= } { | start block () start 1 + :start } while
} :for

{ f |
  0 false { v created |
    { this |
      created not { | true :created  this f () :v } if
      v
    }
  } ()
} :factory

{ a f | 0 a len 1 - { i | a i @ f () } for () } :forEach // works as reduce also

{ a f | [ a f forEach () ] } :map

// Standard Forth-like functions
{ v | v v } :dup
{ _ | } :drop
{ a b | b a } :swap

// A helper function for displaying section titles
{ t | " " print t print } :section

`);


/*
TODO:
  - letrec
  - fix 'nil to be falsey
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
  - Add a recursive array toString method

ifelse is the same as ? ()
a = { x: a b c | 234 x:ret }

  {
     expr if: {
       a map { }
     } else: {  }
     map { }

  }

*/
