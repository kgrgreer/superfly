
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
    partialEval() { return this; }
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
  name: 'AND',
  properties: [ 'arg1', 'arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) && this.arg2.eval(x);
    },

    function partialEval(x) {
      var arg1 = this.arg1.partialEval();
      var arg2 = this.arg2.partialEval();

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
      var arg1 = this.arg1.partialEval();
      var arg2 = this.arg2.partialEval();

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
      var arg1 = this.arg1.partialEval();
      var arg2 = this.arg2.partialEval();

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
  name: 'TIMES',
  properties: [ 'arg1', 'arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) * this.arg2.eval(x);
    },

    function partialEval(x) {
      var arg1 = this.arg1.partialEval();
      var arg2 = this.arg2.partialEval();

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

      return TIMES(arg1, arg2);
    },
    function toJS(x) {
      return `${this.arg1.toJS(x)} * ${this.arg2.toJS(x)}`;
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
      var arg1 = this.arg1.partialEval();
      var arg2 = this.arg2.partialEval();

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
      return x.set(this.key.eval(x), this.value.eval(x));
    },
    function toJS(x) {
      return `var ${this.key.toJS(x)} = ${this.value.toJS(x)};`
    }
  ]
});


CLASS({
  name: 'VAR',
  properties: [ 'key' ],
  methods: [
    function eval(x) {
      return x.get(this.key.eval(x));
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
          y.set(self.args[i], arguments[i]);
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
  name: 'FRAME',
  documentation: 'A Stack-Frame / Context.',

  methods: [
    function subFrame() {
      return Object.create(this);
    },
    function get(name) {
      return this[name];
    },
    function set(name, value) {
      return this[name] = value;
    },
    function toJS(x) {
    }
  ]
});

var frame = FRAME();
var jsFrame = eval(FRAME().toJS());

function test(expr) {
  console.log(expr.toString(), '->', expr.partialEval(frame).toString(), '->', expr.eval(frame));

  // JS testing
  var result;
  try {
    result = eval(expr.toJS());
  } catch(e) {
    result = e;
  }

  console.log('JS', expr.toString(), '->', expr.toJS(), '->', result);
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

console.log('Test Variables');
test(LET(LITERAL('x'), LITERAL(42)));
test(PRINT(VAR(LITERAL('x'))));

// Test Partial-Eval
console.log('eval: ', PLUS(LITERAL(5), LITERAL(4)).eval());
console.log('partialEval: ', PLUS(LITERAL(5), LITERAL(4)).partialEval().toString());
console.log('partialEval + eval: ', PLUS(LITERAL(5), LITERAL(4)).partialEval().eval());

console.log('Test Apply');
test(APPLY(
  LITERAL(function(n) { return n*2; }),
  LITERAL(2)));

console.log('Test Minus');
test(MINUS(LITERAL(10), LITERAL(1)));

console.log('Test If');
test(IF(EQ(LITERAL(1), LITERAL(1)), LITERAL(42), PLUS(LITERAL(2), LITERAL(4))));
test(IF(EQ(LITERAL(1), LITERAL(2)), LITERAL(42), PLUS(LITERAL(2), LITERAL(4))));

console.log('Test And');
test(AND(LITERAL(false), LITERAL(false)));
test(AND(LITERAL(false), LITERAL(true)));
test(AND(LITERAL(true), LITERAL(false)));
test(AND(LITERAL(true), LITERAL(true)));

console.log('Test Or');
test(OR(LITERAL(false), LITERAL(false)));
test(OR(LITERAL(false), LITERAL(true)));
test(OR(LITERAL(true), LITERAL(false)));
test(OR(LITERAL(true), LITERAL(true)));

console.log('Test TIMES');
test(TIMES(LITERAL(5), LITERAL(5)));
test(TIMES(LITERAL(1), LITERAL(42)));
test(TIMES(LITERAL(0), LITERAL(42)));
test(TIMES(LITERAL(42), LITERAL(1)));
test(TIMES(LITERAL(42), LITERAL(0)));
test(TIMES(LITERAL(2), LITERAL(4)));
test(TIMES(VAR(LITERAL('x')), LITERAL(1)));
test(TIMES(VAR(LITERAL('x')), LITERAL(0)));
test(TIMES(LITERAL(1), VAR(LITERAL('x'))));
test(TIMES(LITERAL(0), VAR(LITERAL('x'))));

console.log('Test functions');

var square = FN(['I'], TIMES(VAR(LITERAL('I')), VAR(LITERAL('I'))));
test(APPLY(square, LITERAL(5)));

test(LET(LITERAL('SQUARE'),
  FN(['I'], TIMES(VAR(LITERAL('I')), VAR(LITERAL('I'))))));
test(APPLY(VAR(LITERAL('SQUARE')), LITERAL(5)));

test(LET(LITERAL('FACT'), FN(['I'],
  IF(EQ(VAR(LITERAL('I')), LITERAL('1')),
    LITERAL('1'),
    TIMES(
      VAR(LITERAL('I')),
      APPLY(VAR(LITERAL('FACT')), MINUS(VAR(LITERAL('I')), LITERAL(1))))))));

test(APPLY(VAR(LITERAL('FACT')), LITERAL(1)));
test(APPLY(VAR(LITERAL('FACT')), LITERAL(5)));

console.log('done');
