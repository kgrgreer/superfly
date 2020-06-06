const TEST_JS = false;

if ( typeof performance == 'undefined' ) {
  var start = Date.now();
  performance = {
    now: function() {
      return Date.now() - start;
    }
  };
}

const TYPES = {
  'String[]': v => {
    if ( typeof v == 'string' ) return [ v ];
    return v;
  },
  'Map': v => v ? v.map(TYPES.Expr) : [],
  BigInt: BigInt,
  IMM8:  v => typeof v === 'number' ? IMM8(v) : v,
  IMM16: v => typeof v === 'number' ? IMM16(v) : v,
  IMM32: v => typeof v === 'number' ? IMM32(v) : v,
  IMM64: v => typeof v === 'bigint' || typeof v == 'number' ? IMM64(v) : v,
  Expr:  v => {
    if ( typeof v === 'number'   ) return LITERAL(v);
    if ( typeof v === 'string'   ) return LITERAL(v);
    if ( typeof v === 'function' ) return LITERAL(v);
    if ( typeof v === 'boolean'  ) return LITERAL(v);
    if (        v === null       ) return LITERAL(v);
    return v;
  },
  Frame:  v => {
    if ( typeof v === 'string' ) return VAR(v);
    return TYPES.Expr(v);
  }
};


function CLASS(model) {
  if ( ! model.properties ) {
    model.properties = [];
  } else {
    model.properties = model.properties.map((p) => {
      var a = p.split(' ');
      if ( a.length == 1 ) { return { name: a[0], adapt: v => v }; }

      return {
        name: a[1],
        adapt: TYPES[a[0]]
      };
    });
  }

  var proto_ = {
    toString() {
      var s = model.name + '(';

      for ( var i = 0 ; i < model.properties.length ; i++ ) {
        var val = this[model.properties[i].name];
        if ( val === undefined ) break;
        if ( i ) s += ', ';
        s = s + val;
      }

      s = s + ')';

      return s;
    },
    partialEval() { return this; },
    toJS() { return '<JS NOT DEFINED for ' + model.NAME + '>'; },
    initArgs(...args) {
      for ( var i = 0 ; i < model.properties.length && i < args.length ; i++ ) {
        this[model.properties[i].name] = model.properties[i].adapt(args[i]);
      }
    },
    toBinary(x) {
      return model.properties.map(p => this[p.name].toBinary(x));
    }
  };

  var cls = function(...args) {
    var o = Object.create(proto_);
    o.initArgs(...args);
    return o;
  };

  cls.isInstance = function(o) { return o.__proto__ == proto_; }

  if ( model.methods ) {
    for ( var i = 0 ; i < model.methods.length ; i++ ) {
      var m = model.methods[i];

      var match = m.toString().
          match(/^function\s+([A-Za-z_$][0-9A-Za-z_$]*)\s*\(/);
      var name = match[1];

      proto_[name] = m;
    }
  }

  globalThis[model.name] = cls;
}

CLASS({
  name: 'SuperflyParser',
  properties: [ 'str' ],
  methods: [
    function head(s, opt_i) { opt_i = opt_i || 0; return this.str.charAt(s[0] + opt_i); },

    function prepPs(ps) {
      return ps.map(this.prep.bind(this));
    },

    function prep(p) {
      if ( typeof p === 'string' ) return this.literal(p);
      return p;
    },

    function literal(str, opt_value) {
      var f = (s) => {
        for ( var i = 0 ; i < str.length ; i++ ) {
          if ( str.charAt(i) != this.head(s, i) ) return;
        }
        return [s[0]+str.length, opt_value || str];
      }

      f.toString = function() { return 'literal(' + str + ')'; };

      return f;
    },

    function seq(...ps) {
      ps = this.prepPs(ps);

      var f = function(s) {
        var ret = [];

        for ( var i = 0 ; i < ps.length ; i++ ) {
          if ( ! ( s = ps[i](s) ) ) return;
          ret.push(s[1]);
        }

        return [s[0], ret];
      };

      f.toString = function() { return 'seq(' + ps.join(',') + ')'; };

      return f;
    },

    function alt(...ps) {
      ps = this.prepPs(ps);

      var f = function(s) {
        for ( var i = 0 ; i < ps.length ; i++ ) {
          var s2;
          if ( s2 = ps[i](s) ) return s2;
        }
      };

      f.toString = function() { return 'alt(' + ps.join(',') + ')'; };

      return f;
    },

    function opt(p) {
      p = this.prep(p);
      var f = function(s) { return p(s) || [s[0]]; };

      f.toString = function() { return 'opt(' + p + ')'; };

      return f;
    },

    function range(c1, c2) {
      var f = s => {
        var h = this.head(s);
        if ( h === '' || h < c1 || h > c2 ) return;
        return [s[0]+1, h];
      };

      f.toString = function() { return 'range(' + c1 + ', ' + c2 + ')'; };

      return f;
    },

    function anyChar() {
      var f = s => {
        var h = this.head(s);
        if ( h != '' ) return [ s[0]+1, h ];
      };

      f.toString = function() { return 'anyChar()'; };

      return f;
    },

    function repeat(p, opt_delim, opt_min, opt_max) {
      p = this.prep(p);
      opt_delim = this.prep(opt_delim);

      var f = function(s) {
        var ret = [];

        for ( var i = 0 ; ! opt_max || i < opt_max ; i++ ) {
          var res;

          if ( opt_delim && ret.length != 0 ) {
            if ( ! ( res = opt_delim[s] ) ) break;
            s = res;
          }

          if ( ! ( res = p(s) ) ) break;

          ret.push(res[1]);
          s = res;
        }

        if ( opt_min && ret.length < opt_min ) return;

        return [s[0], ret];
      };

      f.toString = function() { return 'repeat(' + p + ', ' + opt_delim + ', ' + opt_min + ', ' + opt_max + ')'; };

      return f;
    },

    function plus(p) {
      return this.repeat(p, null, 1);
    },

    /** Takes a parser which returns an array, and converts its result to a String. **/
    function toStr(p) {
      p = this.prep(p);
      var f = s => {
        s = p(s);
        return s && [s[0], s[1].join('')];
      };

      f.toString = function() { return 'toStr(' + p + ')'; };

      return f;
    },

    function not(p, opt_else) {
      p        = this.prep(p);
      opt_else = this.prep(opt_else);

      var f = s => p(s) ? undefined : opt_else ? opt_else(s) : s;
      f.toString = function() { return 'not(' + p + ')'; };

      return f;
    },

    // Above: generic parse combinators
    // Below: superly parsers

    function whitespaceChar() { return this.alt(' ', '\t', '\n', '\r'); },

    function whitespace() { return this.toStr(this.plus(this.whitespaceChar())); },

    function notWhitespace() { return this.toStr(this.plus(this.not(this.whitespaceChar(), this.anyChar()))); },

    function numChar() { return this.range('0', '9'); },

    function number() {
      return this.toStr(this.seq(
        this.opt('-'),
        this.toStr(this.plus(this.numChar()))
      ));
    },

    function parse() {
      return this.alt(
        'funning',
        this.seq(
          'test',
          'ing'))([0])[1];
    }
  ]
});

console.log('------------------------------- ', SuperflyParser('testing').parse());
console.log('------------------------------- ', SuperflyParser('funning').parse());
console.log('------------------------------- range', SuperflyParser('a').range('a','z')([0]));
console.log('------------------------------- range', SuperflyParser('A').range('a','z')([0]));
console.log('------------------------------- opt', SuperflyParser('abc').opt('a')([0]));
console.log('------------------------------- opt', SuperflyParser('bc').opt('a')([0]));
console.log('------------------------------- wschar', SuperflyParser(' ').whitespaceChar()([0]));
console.log('------------------------------- wschar', SuperflyParser('a').whitespaceChar()([0]));
console.log('------------------------------- ws', SuperflyParser(' \r\n\t    \nhello').whitespace()([0]));
console.log('------------------------------- !ws', SuperflyParser('this is a test').notWhitespace()([0]));
console.log('------------------------------- number', SuperflyParser('1234').number()([0]));
console.log('------------------------------- number', SuperflyParser('-1234').number()([0]));


CLASS({
  name: 'LITERAL',
  properties: [ 'value' ],
  methods: [
    function eval(x) {
      return this.value;
    },
    function toJS(x) {
      return this.value.toString();
    }
  ]
});


CLASS({
  name: 'CHAR_AT',
  properties: [ 'Expr str', 'Expr pos' ],
  methods: [
    function eval(x) {
      return this.str.eval(x).charAt(this.pos.eval(x));
    },
    function toJS(x) {
      return `(${this.str.toJS(x)}.charAt(${this.pos.toJS(x)}))`;
    }
  ]
});


CLASS({
  name: 'EQ',
  properties: [ 'Expr arg1', 'Expr arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) == this.arg2.eval(x);
    },
    function toJS(x) {
      return `(${this.arg1.toJS(x)} == ${this.arg2.toJS(x)})`;
    }
  ]
});


CLASS({
  name: 'LT',
  properties: [ 'Expr arg1', 'Expr arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) < this.arg2.eval(x);
    },
    function toJS(x) {
      return `(${this.arg1.toJS(x)} < ${this.arg2.toJS(x)})`;
    }
  ]
});


CLASS({
  name: 'GT',
  properties: [ 'Expr arg1', 'Expr arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) > this.arg2.eval(x);
    },
    function toJS(x) {
      return `(${this.arg1.toJS(x)} > ${this.arg2.toJS(x)})`;
    }
  ]
});


CLASS({
  name: 'LTE',
  properties: [ 'Expr arg1', 'Expr arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) <= this.arg2.eval(x);
    },
    function toJS(x) {
      return `(${this.arg1.toJS(x)} <= ${this.arg2.toJS(x)})`;
    }
  ]
});


CLASS({
  name: 'GTE',
  properties: [ 'Expr arg1', 'Expr arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) >= this.arg2.eval(x);
    },
    function toJS(x) {
      return `(${this.arg1.toJS(x)} >= ${this.arg2.toJS(x)})`;
    }
  ]
});


CLASS({
  name: 'AND',
  properties: [ 'Expr arg1', 'Expr arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) && this.arg2.eval(x);
    },

    function partialEval(x) {
      var arg1 = this.arg1.partialEval(x);
      var arg2 = this.arg2.partialEval(x);

      if ( LITERAL.isInstance(arg1) ) {
        var v1 = arg1.eval(x);
        if ( ! v1 ) return LITERAL(false);
        return arg2;
      }

      if ( LITERAL.isInstance(arg2) ) {
        var v2 = arg2.eval(x);
        if ( ! v2 ) return LITERAL(false);
        return arg1;
      }

      return AND(arg1, arg2);
    },

    function toJS(x) {
      return `(${this.arg1.toJS(x)} && ${this.arg2.toJS(x)})`;
    }
  ]
});


CLASS({
  name: 'OR',
  properties: [ 'Expr arg1', 'Expr arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) || this.arg2.eval(x);
    },

    function partialEval(x) {
      var arg1 = this.arg1.partialEval(x);
      var arg2 = this.arg2.partialEval(x);

      if ( LITERAL.isInstance(arg1) ) {
        var v1 = arg1.eval(x);
        if ( v1 ) return LITERAL(true);
        return arg2;
      }

      if ( LITERAL.isInstance(arg2) ) {
        var v2 = arg2.eval(x);
        if ( v2 ) return LITERAL(true);
        return arg1;
      }

      return OR(arg1, arg2);
    },
    function toJS(x) {
      return `(${this.arg1.toJS(x)} || ${this.arg2.toJS(x)})`;
    }
  ]
});


CLASS({
  name: 'NOT',
  properties: [ 'Expr expr' ],
  methods: [
    function eval(x) {
      return ! this.expr.eval(x);
    },
    function toJS(x) {
      return `(! ${this.expr.toJS(x)})`;
    }
  ]
});


CLASS({
  name: 'ADD',
  properties: [ 'Expr arg1', 'Expr arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) + this.arg2.eval(x);
    },

    function partialEval(x) {
      var arg1 = this.arg1.partialEval(x);
      var arg2 = this.arg2.partialEval(x);

      if ( LITERAL.isInstance(arg1) && LITERAL.isInstance(arg2) ) {
        return LITERAL(arg1.eval(x) + arg2.eval(x));
      }

      return ADD(arg1, arg2);
    },
    function toJS(x) {
      return `(${this.arg1.toJS(x)} + ${this.arg2.toJS(x)})`;
    }
  ]
});


CLASS({
  name: 'MUL',
  properties: [ 'Expr arg1', 'Expr arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) * this.arg2.eval(x);
    },

    function partialEval(x) {
      var arg1 = this.arg1.partialEval(x);
      var arg2 = this.arg2.partialEval(x);

      if ( LITERAL.isInstance(arg1) && LITERAL.isInstance(arg2) ) {
        return LITERAL(arg1.eval(x) * arg2.eval(x));
      }

      if ( LITERAL.isInstance(arg1) ) {
        var v1 = arg1.eval(x);
        if ( v1 == 0 ) return 0;
        if ( v1 == 1 ) return arg2;
      }

      if ( LITERAL.isInstance(arg2) ) {
        var v2 = arg2.eval(x);
        if ( v2 == 0 ) return 0;
        if ( v2 == 1 ) return arg1;
      }

      return MUL(arg1, arg2);
    },
    function toJS(x) {
      return `(${this.arg1.toJS(x)} * ${this.arg2.toJS(x)})`;
    }
  ]
});


CLASS({
  name: 'DIV',
  properties: [ 'Expr arg1', 'Expr arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) / this.arg2.eval(x);
    },

    function partialEval(x) {
      var arg1 = this.arg1.partialEval(x);
      var arg2 = this.arg2.partialEval(x);

      if ( LITERAL.isInstance(arg1) && LITERAL.isInstance(arg2) ) {
        return LITERAL(arg1.eval(x) / arg2.eval(x));
      }

      if ( LITERAL.isInstance(arg2) ) {
        var v2 = arg2.eval(x);
        // if ( v2 == 0 ) error divide by zer
        if ( v2 == 1 ) return arg1;
      }

      return DIV(arg1, arg2);
    },
    function toJS(x) {
      return `(${this.arg1.toJS(x)} / ${this.arg2.toJS(x)})`;
    }
  ]
});


CLASS({
  name: 'SUB',
  properties: [ 'Expr arg1', 'Expr arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) - this.arg2.eval(x);
    },

    function partialEval(x) {
      var arg1 = this.arg1.partialEval(x);
      var arg2 = this.arg2.partialEval(x);

      if ( LITERAL.isInstance(arg1) && LITERAL.isInstance(arg2) ) {
        return LITERAL(arg1.eval(x) - arg2.eval(x));
      }

      return SUB(arg1, arg2);
    },

    function toJS(x) {
      return `(${this.arg1.toJS(x)} - ${this.arg2.toJS(x)})`;
    }
  ]
});


CLASS({
  name: 'LET',
  properties: [ 'Expr key', 'Expr value' ],
  methods: [
    function eval(x) {
      x.set(this.key.eval(x), SLOT(this.value.partialEval(x).eval(x)));
    },
    function toJS(x) {
      return `var ${this.key.toJS(x)} = ${this.value.toJS(x)}`
    }
  ]
});

// TODO: 'SET'

CLASS({
  name: 'CONST',
  documentation: "The same as LET but can partialEval() the lookup becuase it doesn't change.",
  properties: [ 'Expr key', 'Expr value' ],
  methods: [
    function eval(x) {
      x.set(this.key.eval(x), CONSTANT_SLOT(this.value.partialEval(x).eval(x)));
    },
    function partialEval(x) {
      return LITERAL(this.value.eval(x));
    },
    function toJS(x) {
      return `const ${this.key.toJS(x)} = ${this.value.toJS(x)}`
    }
  ]
});


CLASS({
  name: 'VAR',
  properties: [ 'Expr key' ],
  methods: [
    function eval(x) {
      return x.get(this.key.eval(x)).eval();
      /*
      Experiment, but not faster.
      var slot = this.slot;
      if ( slot && x == this.lastX ) return slot.eval(x);
      slot = this.slot = x.get(this.key.eval(x));
      this.lastX = x;
      return slot.eval(x);
      */
      // TODO This breaks when doing recursion, because x may have
      // changed from the last time we were evaluated to a sub-frame.
      /*
      if ( ! this.slot ) this.slot = x.get(this.key.eval(x));
      return this.slot.eval(x);
      */
    },
    function partialEval(x) {
      var key = this.key.partialEval(x);
      var slot = x.get(key.eval(x));
      if ( slot && CONSTANT_SLOT.isInstance(slot) ) return slot.eval(x);
     // if ( LITERAL.isInstance(this.key) ) return VAR(this.key.eval(x));
      return this;
      /*
      if ( ! this.slot ) this.slot = x.get(this.key.eval(x));
      return this.slot.partialEval(x);
      */
    },
    function toJS(x) {
      return this.key.toJS(x);
    }
  ]
});


CLASS({
  name: 'APPLY',
  properties: [ 'Expr fn', 'Expr args' ],
  methods: [
    function eval(x) {
      return this.fn.eval(x)(this.args.eval(x));
    },
    function partialEval(x) {
      var fn   = this.fn.partialEval(x);
      var args = this.args.partialEval(x);
      if ( LITERAL.isInstance(fn) ) return LITERAL_APPLY(fn.eval(x), args);
      return APPLY(fn, args);
    },
    function toJS(x) {
      return `(${this.fn.toJS(x)})(${this.args.toJS(x)})`;
    }
  ]
});


CLASS({
  name: 'LITERAL_APPLY',
  properties: [ 'fn', 'Expr args' ],
  methods: [
    function eval(x) {
      return this.fn(this.args.eval(x));
    },
    function partialEval(x) {
      return this;
    },
    function toJS(x) {
      return `(${this.fn})(${this.args.toJS(x)})`;
    }
  ]
});


CLASS({
  name: 'FN',
  properties: [ 'String[] args', 'Expr expr' ],
  methods: [
    function eval(x) {
      var self = this;
      return function() {
        var y = x.subFrame();
        for ( var i = 0 ; i < self.args.length ; i++ ) {
          y.set(self.args[i], SLOT(arguments[i]));
        }
        return self.expr.eval(y);
      }
    },
    function partialEval(x) {
      return FN(this.args, this.expr.partialEval(x));
    },
    function toJS(x) {
      return `function(${this.args.join(',')}) { return ${this.expr.toJS(x)} }`;
    }
  ]
});


CLASS({
  name: 'IF',
  properties: [ 'Expr expr', 'Expr ifBlock', 'Expr elseBlock' ],
  methods: [
    function eval(x) {
      var b = this.expr.eval(x);

      if ( b ) return this.ifBlock.eval(x);

      var elseBlock = this.elseBlock;

      return elseBlock && elseBlock.eval(x);
    },
    function partialEval(x) {
      var expr = this.expr.partialEval(x);

      if ( LITERAL.isInstance(expr) ) {
        if ( expr.eval(x) ) return this.ifBlock.partialEval(x);
        return this.elseBlock && this.elseBlock.partialEval(x);
      }

      return IF(
        expr,
        this.ifBlock.partialEval(x),
        this.elseBlock && this.elseBlock.partialEval(x));
    },
    function toJS(x) {
      // TODO: Are the if/else cases blocks or expressions?  This
      // assumes that they are expression.

      return `( ( ${this.expr.toJS(x)} ) ? ( ${this.ifBlock.toJS(x)} ) : ( ${this.elseBlock.toJS(x)} ) )`;
    }
  ]
});


CLASS({
  name: 'COND',
  // Lisp COND like series of conditions and bodies to execute.

  properties: [
    'args'
  ],
  methods: [
    function initArgs(...args) {
      this.args = args;
    },
    function eval(x) {
      for ( var i = 0 ; i < this.args.length ; i += 2 ) {
        var c = this.args[i].eval(x);
        if ( c ) return this.args[i + 1].eval(x);
      }
    }
  ]
});


CLASS({
  name: 'SWITCH',
  // Chainable switch function

  properties: [
    'Map choices',
    'Expr defaultExpr'
  ],
  methods: [
    function eval(x) {
      return expr => {
        for ( var i = 0 ; i < this.choices.length ; i += 2 ) {
          var val = this.choices[i].eval(x);
          if ( val == expr ) return this.choices[i + 1].eval(x);
        }

        if ( this.defaultExpr != undefined ) {
          var dExpr = this.defaultExpr.eval(x);
          return typeof dExpr == 'function' ? dExpr(expr) : dExpr;
        }
      };
    }
  ]
});


CLASS({
  name: 'PRINT',
  properties: [ 'Expr expr' ],
  methods: [
    function eval(x) {
      console.log(this.expr.eval(x));
    },
    function toJS(x) {
      return `console.log(${this.expr.toJS(x)})`;
    }
  ]
});


CLASS({
  name: 'SEQ',
  properties: [
    'args'
  ],
  methods: [
    function initArgs(...args) {
      this.args = args;
    },
    function eval(x) {
      return this.args.reduce((result, step) => step.eval(x), null);
    },
    function toJS(x) {
      // TODO: Whats the right way to return the final value?
      return this.args.map(a => a.toJS(x)).join(';\n');
    },
    function toBinary(x) {
      return this.args.map(a => a.toBinary(x)).flat();
    }
  ]
});

/*
CLASS({
  name: 'SLOT',
  documentation: 'A Stack-Frame entry.',

  properties: [ 'value' ],

  methods: [
    function eval() {
      return this.value;
    },
    function set(value) {
      this.value = value;
    }
  ]
});
*/

SLOT = function(value) {
  return {
    name: 'SLOT',
    eval: function() { return value; },
    set: function(val) { value = val; },
    partialEval: function() { return this; }
  };
}


CLASS({
  name: 'CONSTANT_SLOT',
  documentation: 'A Stack-Frame entry.',

  properties: [ 'value' ],

  methods: [
    function eval() {
      return this.value;
    },
    function partialEval() {
      return LITERAL(this.value);
    },
    function set(value) {
      // Can't update a constant
    }
  ]
});


CLASS({
  name: 'GET',
  properties: [
    'Frame frame',
    'Expr key',
  ],
  methods: [
    function eval(x) {
      return this.frame.eval(x).get(this.key.eval(x)).eval();
    }
  ]
});


CLASS({
  name: 'SET',
  properties: [
    'Frame frame',
    'Expr key',
    'Expr value'
  ],
  // Returns frame
  methods: [
    function eval(x) {
      return this.frame.eval(x).set(this.key.eval(x), SLOT(this.value.eval(x)));
    }
  ]
});


CLASS({
  name: 'FRAME',
  documentation: 'A Stack-Frame / Context.',

  methods: [
    function eval(x) {
      return FRAME();
    },
    function subFrame() {
//      return Object.create(frame); // is ~8% faster
      return Object.create(this);
    },
    function get(name) {
      var slot = this[name];
      if ( ! slot ) {
        console.log("Unknown variable name ", name);
      } else {
        return slot;
      }
    },
    function set(name, slot) {
      this[name] = slot;
      return this;
    }
  ]
});


var frame = FRAME();

function test(expr) {
  var partial = expr.partialEval(frame);
  var start   = performance.now();
  var result  = partial.eval(frame);
  var end     = performance.now();
  console.log('SF', expr.toString(), '->', partial.toString(), '->', result, ' Time: ' + (end-start).toFixed(3) + " ms");

  if ( ! TEST_JS ) return;

  // JS testing
  start = performance.now();
  try {
    result = eval(expr.toJS());
  } catch(e) {
    result = e;
  }
  end = performance.now();

  console.log('JS', expr.toString(), '->', expr.toJS(), '->', result, ' Time: ' + (end-start).toFixed(3) + ' ms');
}

function title(s) {
  console.log('\n');
  console.log('Testing ' + s);
  console.log('-------------------------');
}

title('Basics');
test(LITERAL(5));

test(EQ(5, 4));
test(EQ(5, 4));

test(NOT(EQ(5, 4)));

test(ADD(5, 4));

PRINT(ADD(5, 4)).eval();

test(PRINT(ADD(5, 4)));

test(PRINT(EQ(
  ADD(5, 4),
  SUB(10, 1)
)));

console.log(EQ(
  ADD(5, 4),
  SUB(10, 1)
).toString());

console.log(EQ(
  ADD(5, 4),
  SUB(10, 1)
).toJS());

title('LT');
test(LT(5, 4));
test(LT(4, 5));

title('GT');
test(GT(5, 4));
test(GT(4, 5));

title('Variables');
test(LET('x', 42));
PRINT(VAR('x')).eval(frame);

test(SEQ(
  LET('x', 42),
  VAR('x')
));

title('Partial-Eval');
console.log('eval: ', ADD(5, 4).eval());
console.log('partialEval: ', ADD(5, 4).partialEval().toString());
console.log('partialEval + eval: ', ADD(5, 4).partialEval().eval());

title('Apply');
test(APPLY(function(n) { return n*2; }, 2));

title('SUB');
test(SUB(10, 1));

title('If');
test(IF(EQ(1, 1), 42, ADD(2, 4)));
test(IF(EQ(1, 2), 42, ADD(2, 4)));

title('And');
test(AND(false, false));
test(AND(false, true));
test(AND(true, false));
test(AND(true, true));

title('Or');
test(OR(false, false));
test(OR(false, true));
test(OR(true, false));
test(OR(true, true));

title('MUL');
test(MUL(5, 5));
test(MUL(1, 42));
test(MUL(0, 42));
test(MUL(42, 1));
test(MUL(42, 0));
test(MUL(2, 4));
test(SEQ(LET('X', 42), MUL(VAR('X'), 1)));
test(SEQ(LET('X', 42), MUL(VAR('X'), 0)));
test(SEQ(LET('X', 42), MUL(1, VAR('X'))));
test(SEQ(LET('X', 42), MUL(0, VAR('X'))));

title('DIV');
test(DIV(5, 5));
test(DIV(1, 42));
test(DIV(0, 42));
test(DIV(42, 1));
test(DIV(42, 0));
test(DIV(2, 4));
test(SEQ(LET('X', 42), DIV(VAR('x'), 1)));
test(SEQ(LET('X', 42), DIV(VAR('x'), 0)));
test(SEQ(LET('X', 42), DIV(1, VAR('x'))));
test(SEQ(LET('X', 42), DIV(0, VAR('x'))));

title('Functions');
var square = FN('I', MUL(VAR('I'), VAR('I')));
test(APPLY(square, 5));

test(SEQ(
  LET('SQUARE', FN('I', MUL(VAR('I'), VAR('I')))),
  APPLY(VAR('SQUARE'), 5)
));

test(SEQ(
  LET('SQUARE', FN('I', MUL(VAR('I'), VAR('I')))),
  APPLY(VAR('SQUARE'), 5)
));

var FACT = LET('FACT', FN('I',
  IF(EQ(VAR('I'), 1),
    1,
    MUL(
      VAR('I'),
      APPLY(VAR('FACT'), SUB(VAR('I'), 1))))));

test(SEQ(FACT, APPLY(VAR('FACT'), 1)));
test(SEQ(FACT, APPLY(VAR('FACT'), 5)));
test(SEQ(FACT, APPLY(VAR('FACT'), 50)));

title('Fibonacci');
CONST('FIB', FN('I',
  IF(LT(VAR('I'), 2),
    1,
    ADD(
      APPLY(VAR('FIB'), SUB(VAR('I'), 1)),
      APPLY(VAR('FIB'), SUB(VAR('I'), 2)))))).eval(frame);


test(APPLY(VAR('FIB'), 1));
test(APPLY(VAR('FIB'), 2));
test(APPLY(VAR('FIB'), 3));
test(APPLY(VAR('FIB'), 4));
test(APPLY(VAR('FIB'), 5));
test(APPLY(VAR('FIB'), 6));
test(APPLY(VAR('FIB'), 7));
test(APPLY(VAR('FIB'), 8));
test(APPLY(VAR('FIB'), 9));
test(APPLY(VAR('FIB'), 10));
test(APPLY(VAR('FIB'), 20));
test(APPLY(VAR('FIB'), 30));

/*
var f = APPLY(VAR('FIB'), 25).partialEval(frame);
console.log('__________________START');
console.profile();
for ( var i = 0 ; i < 100 ; i++ ) f.eval(frame);
console.profileEnd();
console.log('__________________END');
*/

title('SWITCH');
test(PRINT(APPLY(SWITCH([],'default'), 1)));
test(PRINT(APPLY(SWITCH(undefined,'default'), 1)));
test(PRINT(APPLY(SWITCH(
  [
    1, 'Monday',
    2, 'Tuesday',
    3, 'Wednesday',
    4, 'Thursday',
    5, 'Friday'
  ], 'Weekend'
), 3)));
test(PRINT(APPLY(SWITCH(
  [
    1, 'Monday',
    2, 'Tuesday',
    3, 'Wednesday',
    4, 'Thursday',
    5, 'Friday'
  ], 'Weekend'
), 0)));
test(PRINT(APPLY(SWITCH(
  [
    1, 'Monday',
    2, 'Tuesday',
    3, 'Wednesday',
    4, 'Thursday',
    5, 'Friday'
  ], SWITCH([ 0, 'Sunday', 6, 'Saturday' ])
), 0)));


title('CONST');
LET('PI', Math.PI).eval(frame);
test(MUL(2, VAR('PI')));

CONST('PI_CONST', Math.PI).eval(frame);
test(MUL(2, VAR('PI_CONST')));

title('CHAR_AT');
test(CHAR_AT('abcdef', 0));
test(CHAR_AT('abcdef', 1));
test(CHAR_AT('abcdef', 2));

title('Objects');

test(LET('foo', FRAME()))

test(SET('foo', 'key', 'value'));

test(GET(VAR('foo'), 'key', 'value'));

/*
test(LET('StringPStream',
    FN('name',
       COND(
         EQ(VAR('name'), 'create'),
         FN('string',
            SEQ(LET('obj', FRAME()),
                SET(VAR('obj'), 'string', VAR('string')),
                SET(VAR('obj'), 'position', 0),
                SET(VAR('obj'), 'value', null),
                VAR('obj'))),
         EQ(VAR('name'), 'head'),
         FN('ps', APPLY(function(ps) { return ps.string.eval()[ps.position.eval()] }, VAR('ps'))),
         EQ(VAR('name'), 'tail'),
         FN('ps', SEQ(LET('tail', FRAME()),
                      SET(VAR('tail'), 'string', GET(VAR('ps'), 'string')),
                      SET(VAR('tail'), 'position', GET(VAR('ps'), 'position')),
                      SET(VAR('tail'), 'value', null),
                      VAR('tail'))),
         EQ(VAR('name'), 'value'), FN('ps', GET(VAR('ps'), 'value')),
         EQ(VAR('name'), 'setValue'),
         FN('ps', FN('value', SEQ(LET('ret', FRAME()),
                                  SET(VAR('ret'), 'string', GET(VAR('ps'), 'string')),
                                  SET(VAR('ret'), 'position', GET(VAR('ps'), 'position')),
                                  SET(VAR('ret'), 'value', VAR('value')),
                                  VAR('ret'))))))));


test(APPLY(VAR('StringPStream'), 'head'));

test(LET('ps', APPLY(APPLY(VAR('StringPStream'), 'create'), 'hello')));

test(GET(VAR('ps'), 'string'));

test(SEQ(LET('ps', APPLY(APPLY(VAR('StringPStream'), 'create'), 'hello')),
         PRINT(APPLY(APPLY(VAR('StringPStream'), 'head'), VAR('ps')))));

*/

/*
CLASS({
  name: 'StringPStream',
  properties: [ 'String str', 'Int pos', 'Expr value' ],
  methods: {
    head: FN(this, CHAR_AT(GET('this', 'string'), GET('this', 'position'))),
    tail: FN('ps', SEQ(
      LET('tail', FRAME()),
      SET(VAR('tail'), 'string',   GET(VAR('ps'), 'string')),
      SET(VAR('tail'), 'position', GET(VAR('ps'), 'position')),
      SET(VAR('tail'), 'value',    null),
      VAR('tail')
    )),
    setValue: FN('ps', FN('value', SEQ(
      LET('ret', FRAME()),
      SET(VAR('ret'), 'string',   GET(VAR('ps'), 'string')),
      SET(VAR('ret'), 'position', GET(VAR('ps'), 'position')),
      SET(VAR('ret'), 'value',    VAR('value')),
      VAR('ret')
    )))
  ]
});
*/

test(LET('StringPStream',
  SWITCH([
    'create', FN('string', SEQ(
      LET('obj', FRAME()),
      SET('obj', 'string',   VAR('string')),
      SET('obj', 'position', 0),
      SET('obj', 'value',    null)
    )),

    'head', FN('this', CHAR_AT(GET('this', 'string'), GET('this', 'position'))),

    'tail', FN('this', SEQ(
      LET('tail', FRAME()),
      SET('tail', 'string',   GET('this', 'string')),
      SET('tail', 'position', GET('this', 'position')),
      SET('tail', 'value',    null)
    )),

    'value', FN('this', GET(VAR('this'), 'value')),

    // TODO: use 3 arg constructor when available
    'setValue', FN('this', FN('value', SEQ(
      LET('ret', FRAME()),
      SET('ret', 'string',   GET('this', 'string')),
      SET('ret', 'position', GET('this', 'position')),
      SET('ret', 'value',    VAR('value')),
    )))
  ])
));

test(APPLY(VAR('StringPStream'), 'head'));

test(LET('ps', APPLY(APPLY(VAR('StringPStream'), 'create'), 'hello')));

test(GET('ps', 'string'));

test(SEQ(
  LET('ps', APPLY(APPLY(VAR('StringPStream'), 'create'), 'hello')),
  PRINT(APPLY(APPLY(VAR('StringPStream'), 'head'), VAR('ps')))
));


console.log('done');
