
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

    for ( i = 0 ; i < model.properties.length && i < arguments.length ; i++ ) {
      o[model.properties[i]] = arguments[i];
    }

    return o;
  };

  cls.isInstance = function(o) { return o.__proto__ == proto_; }

  if ( model.methods ) {
    for ( i = 0 ; i < model.methods.length ; i++ ) {
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
    }
  ]
});


CLASS({
  name: 'EQ',
  properties: [ 'arg1', 'arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) == this.arg2.eval(x);
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
    }
  ]
});


CLASS({
  name: 'NOT',
  properties: [ 'expr' ],
  methods: [
    function eval(x) {
      return ! this.expr.eval(x);
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
    }
  ]
});


CLASS({
  name: 'MINUS',
  properties: [ 'arg1', 'arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) - this.arg2.eval(x);
    }
  ]
});


CLASS({
  name: 'LET',
  properties: [ 'key', 'value' ],
  methods: [
    function eval(x) {
      return x.set(this.key.eval(x), this.value.eval(x));
    }
  ]
});


CLASS({
  name: 'VAR',
  properties: [ 'key' ],
  methods: [
    function eval(x) {
      return x.get(this.key.eval(x));
    }
  ]
});


CLASS({
  name: 'APPLY',
  properties: [ 'fn', 'args' ],
  methods: [
    function eval(x) {
      return this.fn.eval(x)(this.args.eval(x));
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
    }
  ]
});

CLASS({
  name: 'PRINT',
  properties: [ 'expr' ],
  methods: [
    function eval(x) {
      console.log(this.expr.eval(x));
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
    }
  ]
});


var frame = FRAME();

function test(expr) {
  console.log(expr.toString(), '->', expr.partialEval(frame).toString(), '->', expr.eval(frame));
}

test(LITERAL(5));

test(EQ(LITERAL(5), LITERAL(4)));

test(NOT(EQ(LITERAL(5), LITERAL(4))));

test(PLUS(LITERAL(5), LITERAL(4)));

test(PLUS(LITERAL(5), LITERAL(4)));

PRINT(PLUS(LITERAL(5), LITERAL(4))).eval();

PRINT(EQ(
  PLUS(LITERAL(5), LITERAL(4)),
  MINUS(LITERAL(10), LITERAL(1))
)).eval();

console.log(EQ(
  PLUS(LITERAL(5), LITERAL(4)),
  MINUS(LITERAL(10), LITERAL(1))
).toString());

// Test Variables
LET(LITERAL('x'), LITERAL(42)).eval(frame);
PRINT(VAR(LITERAL('x'))).eval(frame);

// Test Partial-Eval
console.log('eval: ', PLUS(LITERAL(5), LITERAL(4)).eval());
console.log('partialEval: ', PLUS(LITERAL(5), LITERAL(4)).partialEval().toString());
console.log('partialEval + eval: ', PLUS(LITERAL(5), LITERAL(4)).partialEval().eval());

// Test Apply
PRINT(APPLY(
  LITERAL(function(n) { return n*2; }),
  LITERAL(2)
)).eval();

// Test If
PRINT(IF(EQ(LITERAL(1), LITERAL(1)), LITERAL(42), PLUS(LITERAL(2), LITERAL(4)))).eval();
PRINT(IF(EQ(LITERAL(1), LITERAL(2)), LITERAL(42), PLUS(LITERAL(2), LITERAL(4)))).eval();

// Test And
test(AND(LITERAL(false), LITERAL(false)));
test(AND(LITERAL(false), LITERAL(true)));
test(AND(LITERAL(true), LITERAL(false)));
test(AND(LITERAL(true), LITERAL(true)));

// Test Or
test(OR(LITERAL(false), LITERAL(false)));
test(OR(LITERAL(false), LITERAL(true)));
test(OR(LITERAL(true), LITERAL(false)));
test(OR(LITERAL(true), LITERAL(true)));

console.log('done');
