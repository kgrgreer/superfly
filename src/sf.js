
function CLASS(model) {
  if ( ! model.properties ) model.properties = [];

  var proto_ = {
    toString() {
      var s = model.name + '(';

      for ( var i = 0 ; i < model.properties.length ; i++ ) {
        var val = this[model.properties[i]];
        if ( val === undefined ) break;
        if ( i ) s += ', ';
        s = s + val.toString();
      }

      s = s + ')';

      return s;
    },
    partialEval() { return this; },
    toJS() { return '<JS NOT DEFINED for ' + model.NAME + '>'; }
  };
  var cls = function() {
    var o = Object.create(proto_);

    for ( var i = 0 ; i < model.properties.length && i < arguments.length ; i++ ) {
      o[model.properties[i]] = arguments[i];
    }

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
  properties: [ 'arg1', 'arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) == this.arg2.eval(x);
    },
    function toJS(x) {
      return `${this.arg1.toJS(x)} == ${this.arg2.toJS(x)}`;
    }
  ]
});


CLASS({
  name: 'LT',
  properties: [ 'arg1', 'arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) < this.arg2.eval(x);
    },
    function toJS(x) {
      return `${this.arg1.toJS(x)} < ${this.arg2.toJS(x)}`;
    }
  ]
});


CLASS({
  name: 'GT',
  properties: [ 'arg1', 'arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) > this.arg2.eval(x);
    },
    function toJS(x) {
      return `${this.arg1.toJS(x)} > ${this.arg2.toJS(x)}`;
    }
  ]
});


CLASS({
  name: 'AND',
  properties: [ 'arg1', 'arg2' ],
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
      return `${this.arg1.toJS(x)} && ${this.arg2.toJS(x)}`;
    }
  ]
});

CLASS({
  name: 'OR',
  properties: [ 'arg1', 'arg2' ],
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
      return `${this.arg1.toJS(x)} || ${this.arg2.toJS(x)}`;
    }
  ]
});


CLASS({
  name: 'NOT',
  properties: [ 'expr' ],
  methods: [
    function eval(x) {
      return ! this.expr.eval(x);
    },
    function toJS(x) {
      return `! ( ${this.expr.toJS(x)} )`;
    }
  ]
});


CLASS({
  name: 'PLUS',
  properties: [ 'arg1', 'arg2' ],
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
      return `${this.arg1.toJS(x)} + ${this.arg2.toJS(x)}`;
    }
  ]
});


CLASS({
  name: 'MUL',
  properties: [ 'arg1', 'arg2' ],
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
      return `${this.arg1.toJS(x)} * ${this.arg2.toJS(x)}`;
    }
  ]
});


CLASS({
  name: 'DIV',
  properties: [ 'arg1', 'arg2' ],
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
      return `${this.arg1.toJS(x)} / ${this.arg2.toJS(x)}`;
    }
  ]
});


CLASS({
  name: 'MINUS',
  properties: [ 'arg1', 'arg2' ],
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
      return `${this.arg1.toJS(x)} - ${this.arg2.toJS(x)}`;
    }
  ]
});


CLASS({
  name: 'LET',
  properties: [ 'key', 'value' ],
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
  properties: [ 'key' ],
  methods: [
    function eval(x) {
      return x.get(this.key.eval(x)).eval();
      // TODO This breaks when doing recursion, because x may have
      // changed from the last time we were evaluated to a sub-frame.
      if ( ! this.slot ) this.slot = x.get(this.key.eval(x));
      return this.slot.eval(x);
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
  properties: [ 'fn', 'args' ],
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
  properties: [ 'args', 'expr' ],
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
  properties: [ 'expr', 'ifBlock', 'elseBlock' ],
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
  properties: [ 'expr' ],
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
    'steps'
  ],
  methods: [
    function eval(x) {
      var result;
      for ( var i = 0 ; i < this.steps.length ; i++ ) {
	      result = this.steps[i].eval(x);
      }
      return result;
    },
    function toJS(x) {
      var steps = this.steps.map(s => s.toJS(x));
      steps[steps.length - 1] = steps[steps.length - 1];
      return steps.join(';\n');
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
    },
    function toJS(x) {

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

/*
  // JS testing
  start = performance.now();
  try {
    result = eval(expr.toJS());
  } catch(e) {
    result = e;
  }
  end = performance.now();

  console.log('JS', expr.toString(), '->', expr.toJS(), '->', result, ' Time: ' + (end-start).toFixed(3) + ' ms');
*/
}

function title(s) {
  console.log('\n');
  console.log('Testing ' + s);
  console.log('-------------------------');
}

test(LITERAL(5));

test(EQ(LITERAL(5), LITERAL(4)));

test(NOT(EQ(LITERAL(5), LITERAL(4))));

test(PLUS(LITERAL(5), LITERAL(4)));

PRINT(PLUS(LITERAL(5), LITERAL(4))).eval();

test(PRINT(PLUS(LITERAL(5), LITERAL(4))));

test(PRINT(EQ(
  PLUS(LITERAL(5), LITERAL(4)),
  MINUS(LITERAL(10), LITERAL(1))
)));

console.log(EQ(
  PLUS(LITERAL(5), LITERAL(4)),
  MINUS(LITERAL(10), LITERAL(1))
).toString());

console.log(EQ(
  PLUS(LITERAL(5), LITERAL(4)),
  MINUS(LITERAL(10), LITERAL(1))
).toJS());

title('LT');
test(LT(LITERAL(5), LITERAL(4)));
test(LT(LITERAL(4), LITERAL(5)));

title('GT');
test(GT(LITERAL(5), LITERAL(4)));
test(GT(LITERAL(4), LITERAL(5)));

title('Variables');
test(LET(LITERAL('x'), LITERAL(42)));
PRINT(VAR(LITERAL('x'))).eval(frame);

test(SEQ([
  LET(LITERAL('x'), LITERAL(42)),
  VAR(LITERAL('x'))
]));

// Test Partial-Eval
console.log('eval: ', PLUS(LITERAL(5), LITERAL(4)).eval());
console.log('partialEval: ', PLUS(LITERAL(5), LITERAL(4)).partialEval().toString());
console.log('partialEval + eval: ', PLUS(LITERAL(5), LITERAL(4)).partialEval().eval());

title('Apply');
test(APPLY(
  LITERAL(function(n) { return n*2; }),
  LITERAL(2)));

title('Minus');
test(MINUS(LITERAL(10), LITERAL(1)));

title('If');
test(IF(EQ(LITERAL(1), LITERAL(1)), LITERAL(42), PLUS(LITERAL(2), LITERAL(4))));
test(IF(EQ(LITERAL(1), LITERAL(2)), LITERAL(42), PLUS(LITERAL(2), LITERAL(4))));

title('And');
test(AND(LITERAL(false), LITERAL(false)));
test(AND(LITERAL(false), LITERAL(true)));
test(AND(LITERAL(true), LITERAL(false)));
test(AND(LITERAL(true), LITERAL(true)));

title('Or');
test(OR(LITERAL(false), LITERAL(false)));
test(OR(LITERAL(false), LITERAL(true)));
test(OR(LITERAL(true), LITERAL(false)));
test(OR(LITERAL(true), LITERAL(true)));

title('MUL');
test(MUL(LITERAL(5), LITERAL(5)));
test(MUL(LITERAL(1), LITERAL(42)));
test(MUL(LITERAL(0), LITERAL(42)));
test(MUL(LITERAL(42), LITERAL(1)));
test(MUL(LITERAL(42), LITERAL(0)));
test(MUL(LITERAL(2), LITERAL(4)));
test(SEQ([LET(LITERAL('x'), LITERAL(42)), MUL(VAR(LITERAL('x')), LITERAL(1))]));
test(SEQ([LET(LITERAL('x'), LITERAL(42)), MUL(VAR(LITERAL('x')), LITERAL(0))]));
test(SEQ([LET(LITERAL('x'), LITERAL(42)), MUL(LITERAL(1), VAR(LITERAL('x')))]));
test(SEQ([LET(LITERAL('x'), LITERAL(42)), MUL(LITERAL(0), VAR(LITERAL('x')))]));

title('DIV');
test(DIV(LITERAL(5), LITERAL(5)));
test(DIV(LITERAL(1), LITERAL(42)));
test(DIV(LITERAL(0), LITERAL(42)));
test(DIV(LITERAL(42), LITERAL(1)));
test(DIV(LITERAL(42), LITERAL(0)));
test(DIV(LITERAL(2), LITERAL(4)));
test(SEQ([LET(LITERAL('x'), LITERAL(42)), DIV(VAR(LITERAL('x')), LITERAL(1))]));
test(SEQ([LET(LITERAL('x'), LITERAL(42)), DIV(VAR(LITERAL('x')), LITERAL(0))]));
test(SEQ([LET(LITERAL('x'), LITERAL(42)), DIV(LITERAL(1), VAR(LITERAL('x')))]));
test(SEQ([LET(LITERAL('x'), LITERAL(42)), DIV(LITERAL(0), VAR(LITERAL('x')))]));

title('Functions');

var square = FN(['I'], MUL(VAR(LITERAL('I')), VAR(LITERAL('I'))));
test(APPLY(square, LITERAL(5)));


test(SEQ([
  LET(LITERAL('SQUARE'), FN(['I'], MUL(VAR(LITERAL('I')), VAR(LITERAL('I'))))),
  APPLY(VAR(LITERAL('SQUARE')), LITERAL(5))
]));

test(SEQ([
  LET(LITERAL('SQUARE'), FN(['I'], MUL(VAR(LITERAL('I')), VAR(LITERAL('I'))))),
  APPLY(VAR(LITERAL('SQUARE')), LITERAL(5))
]));

var FACT = LET(LITERAL('FACT'), FN(['I'],
  IF(EQ(VAR(LITERAL('I')), LITERAL('1')),
    LITERAL('1'),
    MUL(
      VAR(LITERAL('I')),
	  APPLY(VAR(LITERAL('FACT')), MINUS(VAR(LITERAL('I')), LITERAL(1)))))));


test(SEQ([FACT, APPLY(VAR(LITERAL('FACT')), LITERAL(1))]));
test(SEQ([FACT, APPLY(VAR(LITERAL('FACT')), LITERAL(5))]));
test(SEQ([FACT, APPLY(VAR(LITERAL('FACT')), LITERAL(50))]));

title('Fibonacci');
CONST(LITERAL('FIB'), FN(['I'],
  SEQ(PRINT(VAR(LITERAL('I'))),
  IF(LT(VAR(LITERAL('I')), LITERAL('2')),
    LITERAL('1'),
    PLUS(
      APPLY(VAR(LITERAL('FIB')), MINUS(VAR(LITERAL('I')), LITERAL(1))),
      APPLY(VAR(LITERAL('FIB')), MINUS(VAR(LITERAL('I')), LITERAL(2)))))))).eval(frame);

test(APPLY(VAR(LITERAL('FIB')), LITERAL(5)));
/*
test(APPLY(VAR(LITERAL('FIB')), LITERAL(1)));
test(APPLY(VAR(LITERAL('FIB')), LITERAL(2)));
test(APPLY(VAR(LITERAL('FIB')), LITERAL(3)));
test(APPLY(VAR(LITERAL('FIB')), LITERAL(4)));
test(APPLY(VAR(LITERAL('FIB')), LITERAL(5)));
*/

title('CONST');
LET(LITERAL('PI'), LITERAL(Math.PI)).eval(frame);
test(MUL(LITERAL(2), VAR(LITERAL('PI'))));

CONST(LITERAL('PI_CONST'), LITERAL(Math.PI)).eval(frame);
test(MUL(LITERAL(2), VAR(LITERAL('PI_CONST'))));

console.log('done');
