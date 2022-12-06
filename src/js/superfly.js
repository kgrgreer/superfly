var stack = [], heap = [], hp, __arrayStart__ = '__arrayStart__', outerCode;
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
  // version allows execution within definition for better meta-programming
  switch2: function(code) {
    var sp = stack.length, l;
    while ( ( l = scope.readSym() ) != 'end' ) scope.evalSym(l, { push: f => f() });
    var options = stack.slice(sp, stack.length);
    stack.length = sp;
    code.push(() => {
      var value = stack.pop();
      for ( var i = 0 ; i < options.length ; i += 2 ) {
        if ( value === options[i] ) {
          stack.push(options[i+1]);
          return;
        }
      }
      stack.push(options[options.length-1]);
    });
  },
  debugger:fn(() => { debugger; }),
  print:   fn(() => { console.log(stack.pop()); }),
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
  '+':    bfn((a,b) => a + b),
  '*':    bfn((a,b) => a * b),
  '-':    bfn((a,b) => a - b),
  '/':    bfn((a,b) => a / b),
  '^':    bfn((a,b) => Math.pow(a,b)),
  '%':    fn(() => { stack.push(stack.pop() / 100); }),
  '()':   fn(() => { var f = stack.pop(); f(); })
};

// Parser Support
scope.charAt  = bfn((s, i) => s.charAt(i));
scope.indexOf = bfn((s, p) => s.indexOf(p));
scope.len     = fn(() => { stack.push(stack.pop().length); });
scope.input_  = fn(() => { stack.push(scope.input); });
scope.ip_     = fn(() => { stack.push(scope.ip); });

// Doesn't work because it doesn't have access to the previous 'code'
scope.emit = function() { var v = stack.pop(); outerCode.push(() => stack.push(v)); };


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

// A helper function for displaying section titles
{ t | " " print t print } :section

`);



scope.eval$(`
'Parsers section ()

{ str pos value |
  { m this |
    m switch
      'head { | " head-> " str pos charAt + print str pos charAt }
      'tail { | str pos 1 + this.head PStream () }
      { | " PStream Unknown Method '" m + '' + print }
    end ()
  }
} :PStream

" 01234" 3 charAt print

// Access to current input:
ip_ print
// input_ print

// Parse Combinators

{ start end c | c start >=  c end <= & } :inRange
{ start end | { ps |
  start end ps.head inRange () { | ps.tail } { | false } ifelse
} } :range

{ str | { ps | 0 { i |
  { | ps.head str i charAt = } { | ps.tail :ps  i 1 + :i } while
  str len i = { | ps } { | false } ifelse
} () } } :literal

{ parsers | { ps | 0 { i |
  { | i parsers len < { | ps parsers i @ () :ps ps } && } { | i 1 + :i } while
  parsers len i = { | ps } { | false } ifelse
} () } } :seq

{ parsers | { ps | 0 false { i ret |
  { | i parsers len < { | ps parsers i @ () :ret ret not } && } { | i 1 + :i } while
  ret
} () } } :alt

{ parser min | { ps | 0 false { i ret |
  { | ps :ret  ps parser () :ps ps } { | i 1 + :i } while
  i min >=  { | ret } { | false } ifelse
} () } } :repeat

{ parser | { ps | ps { ret |
  ps parser () :ret
  ret { | 'optyes print ret } { | 'optno print ps } ifelse
} () } } :optional

{ str | { ps |
  str ps.head indexOf -1 = { | ps.tail } { | false } ifelse
} } :notChars


" thisthenthat0123 " 0 nil PStream () :ps

ps 'this literal () () print
'that print
ps 'that literal () () print


" Seq Parser" section ()
[ 'this literal () 'then literal () 'that literal () ] seq () :seqparser
ps seqparser () print


" Alt Parser" section ()
[ 'something literal () 'this literal () ] alt () :altparser
ps altparser () print


" Range Parser" section ()
'0 '9 range  () :rangeparser
ps rangeparser () print
'a 'z range  () :rangeparser
ps rangeparser () print


" Repeat Parser" section ()
'a 'z range () 1 repeat () :repeatparser
ps repeatparser () print


" Optional Parser" section ()
'this print
ps 'this literal () optional () () print
'that print
ps 'that literal () optional () () print


" NotChars Parser" section ()
ps " 0123456789" notChars () 0 repeat () () print


'Grammar section ()

{ f |
  0 false { v fired |
    { this |
      fired not { | true :fired  this f () :v } if
      v
    }
  } ()
} :memoize

{ v | { | v } } :;

{ |
   // number
  { digit number |
    { m this |
      " Calling: " m + print
      this m switch2
        'sym     { s this | " symbol: " s + print { | s this this () } }
        'parse   { this | this.start }
        'start   { this | 'expr this.sym () }
        'expr    { this | [ 'expr1 this.sym [ this.exprOp 'expr this.sym ] seq () optional () ] seq ()  } memoize ()
        'exprOp  { this | [ '+ literal () '- literal () ] alt () } memoize ()
        'expr1   { this | [ 'expr2 this.sym [ this.expr1Op 'expr1 this.sym ] seq () optional () ] seq ()  } memoize ()
        'expr1Op { this | [ '* literal () '/ literal () ] alt () } memoize ()
        'expr2   { this | [ 'expr3 this.sym [ this.expr2Op 'expr2 this.sym ] seq () optional () ] seq ()  } memoize ()
        'expr2Op { this | '^ literal () } memoize ()
        'expr3   { this | [ this.number 'group this.sym ] alt () } memoize ()
        'group   { this | [ '( literal () 'expr this.sym () ') literal () ] seq () } memoize ()
        'number  { this | this.digit 1 repeat () } memoize ()
        'digit   { this | '0 '9 range () } memoize ()
        { this | " Formula Parser Unknown Method " m + print }
      end ()
    }
  } ()
} :FormulaParser

'a print
" (1+2) " 0 nil PStream () :ps
'b print
FormulaParser () :formulaparser
// ps formulaparser 'digit formulaparser ()  () print
'c print
ps formulaparser.digit () print
'd print
ps formulaparser.number () print
'e print
ps formulaparser.start () print
`);


/*
TODO:
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

a = { x: a b c | 234 x:ret }

  {
     expr if: {
       a map { }
     } else: {  }
     map { }

  }

  // Y-Combinator
  // { f | 'aaa print { x | 'bbb print x x () f () } { x | 'ccc print x x () f () } () } :Y


*/
