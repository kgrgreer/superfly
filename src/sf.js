
const TEST_JS = false;


function CLASS(model) {
  if ( ! model.properties ) {
    model.properties = [];
  } else {
    model.properties = model.properties.map((p) => {
      var a = p.split(' ');
      if ( a.length == 1 ) { return { name: a[0], adapt: v => v } };
      return {
        name: a[1],
        adapt: {
          Expr: v => {
            if ( typeof v === 'number'   ) return LITERAL(v);
            if ( typeof v === 'string'   ) return LITERAL(v);
            if ( typeof v === 'function' ) return LITERAL(v);
            if ( typeof v === 'boolean'  ) return LITERAL(v);
            return v;
          },
        }[a[0]]
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
        s = s + val.toString();
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
  name: 'PLUS',
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

      return PLUS(arg1, arg2);
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
        if ( v1 == 0 ) return LITERAL(0);
        if ( v1 == 1 ) return arg2;
      }

      if ( LITERAL.isInstance(arg2) ) {
        var v2 = arg2.eval(x);
        if ( v2 == 0 ) return LITERAL(0);
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
  name: 'MINUS',
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

      return MINUS(arg1, arg2);
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
      x.set(this.key.eval(x), SLOT(this.value.eval(x)));
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
  properties: [ 'key', 'value' ],
  methods: [
    function eval(x) {
      x.set(this.key.eval(x), CONSTANT_SLOT(this.value.eval(x)));
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
      // TODO This breaks when doing recursion, because x may have
      // changed from the last time we were evaluated to a sub-frame.
      /*
      if ( ! this.slot ) this.slot = x.get(this.key.eval(x));
      return this.slot.eval(x);
      */
    },
    function partialEval(x) {
      if ( ! this.slot ) this.slot = x.get(this.key.eval(x));
      return this.slot.partialEval(x);
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
    function toJS(x) {
      return `(${this.fn.toJS(x)})(${this.args.toJS(x)})`;
    }
    // TODO: partialEval
  ]
});


CLASS({
  name: 'FN',
  properties: [ 'args', 'Expr expr' ],
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

      return this.elseBlock && this.elseBlock.eval(x);
    },
    function toJS(x) {
      // TODO: Are the if/else cases blocks or expressions?  This
      // assumes that they are expression.

      return `( ( ${this.expr.toJS(x)} ) ? ( ${this.ifBlock.toJS(x)} ) : ( ${this.elseBlock.toJS(x)} ) )`;
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
    }
  ]
});


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
  name: 'FRAME',
  documentation: 'A Stack-Frame / Context.',

  methods: [
    function subFrame() {
      return Object.create(this);
    },
    function get(name) {
      if ( ! this[name] ) {
        console.log("Unknown variable name ", name);
      } else {
        return this[name];
      }
    },
    function set(name, slot) {
      this[name] = slot;
    }
  ]
});

var frame = FRAME();

function test(expr) {
  var partial = expr.partialEval(frame);
  var start = performance.now();
  var result = partial.eval(frame);
  var end   = performance.now();
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

test(LITERAL(5));

test(EQ(LITERAL(5), 4));
test(EQ(5, 4));

test(NOT(EQ(5, 4)));

test(PLUS(5, 4));

PRINT(PLUS(5, 4)).eval();

test(PRINT(PLUS(5, 4)));

test(PRINT(EQ(
  PLUS(5, 4),
  MINUS(10, 1)
)));

console.log(EQ(
  PLUS(5, 4),
  MINUS(10, 1)
).toString());

console.log(EQ(
  PLUS(5, 4),
  MINUS(10, 1)
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

// Test Partial-Eval
console.log('eval: ', PLUS(5, 4).eval());
console.log('partialEval: ', PLUS(5, 4).partialEval().toString());
console.log('partialEval + eval: ', PLUS(5, 4).partialEval().eval());

title('Apply');
test(APPLY(
  function(n) { return n*2; },
  2));

title('Minus');
test(MINUS(10, 1));

title('If');
test(IF(EQ(1, 1), 42, PLUS(2, 4)));
test(IF(EQ(1, 2), 42, PLUS(2, 4)));

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
test(MUL(LITERAL(5), LITERAL(5)));
test(MUL(1, 42));
test(MUL(LITERAL(0), 42));
test(MUL(42, 1));
test(MUL(42, LITERAL(0)));
test(MUL(2, 4));
test(SEQ(LET(LITERAL('x'), 42), MUL(VAR(LITERAL('x')), 1)));
test(SEQ(LET(LITERAL('x'), 42), MUL(VAR(LITERAL('x')), LITERAL(0))));
test(SEQ(LET(LITERAL('x'), 42), MUL(1, VAR(LITERAL('x')))));
test(SEQ(LET(LITERAL('x'), 42), MUL(LITERAL(0), VAR(LITERAL('x')))));

title('DIV');
test(DIV(LITERAL(5), LITERAL(5)));
test(DIV(1, 42));
test(DIV(LITERAL(0), 42));
test(DIV(42, 1));
test(DIV(42, LITERAL(0)));
test(DIV(2, 4));
test(SEQ(LET(LITERAL('x'), 42), DIV(VAR(LITERAL('x')), 1)));
test(SEQ(LET(LITERAL('x'), 42), DIV(VAR(LITERAL('x')), LITERAL(0))));
test(SEQ(LET(LITERAL('x'), 42), DIV(1, VAR(LITERAL('x')))));
test(SEQ(LET(LITERAL('x'), 42), DIV(LITERAL(0), VAR(LITERAL('x')))));

title('Functions');

var square = FN(['I'], MUL(VAR(LITERAL('I')), VAR(LITERAL('I'))));
test(APPLY(square, LITERAL(5)));


test(SEQ(
  LET(LITERAL('SQUARE'), FN(['I'], MUL(VAR(LITERAL('I')), VAR(LITERAL('I'))))),
  APPLY(VAR(LITERAL('SQUARE')), LITERAL(5))
));

test(SEQ(
  LET(LITERAL('SQUARE'), FN(['I'], MUL(VAR(LITERAL('I')), VAR(LITERAL('I'))))),
  APPLY(VAR(LITERAL('SQUARE')), LITERAL(5))
));

var FACT = LET('FACT', FN(['I'],
  IF(EQ(VAR('I'), 1),
    1,
    MUL(
      VAR('I'),
	    APPLY(VAR('FACT'), MINUS(VAR('I'), 1))))));


test(SEQ(FACT, APPLY(VAR(LITERAL('FACT')), 1)));
test(SEQ(FACT, APPLY(VAR(LITERAL('FACT')), LITERAL(5))));
test(SEQ(FACT, APPLY(VAR(LITERAL('FACT')), LITERAL(50))));

title('Fibonacci');
CONST(LITERAL('FIB'), FN(['I'],
  IF(LT(VAR(LITERAL('I')), 2),
    1,
    PLUS(
      APPLY(VAR(LITERAL('FIB')), MINUS(VAR(LITERAL('I')), 1)),
      APPLY(VAR(LITERAL('FIB')), MINUS(VAR(LITERAL('I')), 2)))))).eval(frame);

test(APPLY(VAR(LITERAL('FIB')), 1));
test(APPLY(VAR(LITERAL('FIB')), 2));
test(APPLY(VAR(LITERAL('FIB')), LITERAL(3)));
test(APPLY(VAR(LITERAL('FIB')), 4));
test(APPLY(VAR(LITERAL('FIB')), LITERAL(5)));
test(APPLY(VAR(LITERAL('FIB')), LITERAL(6)));
test(APPLY(VAR(LITERAL('FIB')), LITERAL(7)));
test(APPLY(VAR(LITERAL('FIB')), LITERAL(8)));
test(APPLY(VAR(LITERAL('FIB')), LITERAL(9)));
test(APPLY(VAR(LITERAL('FIB')), LITERAL(10)));
test(APPLY(VAR(LITERAL('FIB')), LITERAL(20)));
test(APPLY(VAR(LITERAL('FIB')), LITERAL(30)));

title('CONST');
LET(LITERAL('PI'), LITERAL(Math.PI)).eval(frame);
test(MUL(2, VAR(LITERAL('PI'))));

CONST(LITERAL('PI_CONST'), LITERAL(Math.PI)).eval(frame);
test(MUL(2, VAR(LITERAL('PI_CONST'))));

console.log('done');
