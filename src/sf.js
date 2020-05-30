
function CLASS(model) {
  var proto_ = {};
  var cls = function() {
    var o = Object.create(proto_);

    if ( model.properties ) {
      for ( i = 0 ; i < model.properties.length && i < arguments.length ; i++ ) {
        o[model.properties[i]] = arguments[i];
      }
    }

    return o;
  };

  if ( model.methods ) {
    for ( i = 0 ; i < model.methods.length ; i++ ) {
      var m = model.methods[i];

      var match = m.toString().
          match(/^function\s+([A-Za-z_$][0-9A-Za-z_$]*)\s*\(/);
      var name = match[1];

      console.log('********',name, m);
      proto_[name] = m;
    }
  }

  return cls;
}

var LITERAL = CLASS({
  properties: [ 'value' ],
  methods: [
    function eval(x) {
      return this.value;
    }
  ]
});

var EQ = CLASS({
  properties: [ 'arg1', 'arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) == this.arg2.eval(x);
    }
  ]
});

var PLUS = CLASS({
  properties: [ 'arg1', 'arg2' ],
  methods: [
    function eval(x) {
      return this.arg1.eval(x) + this.arg2.eval(x);
    }
  ]
});

var LET = CLASS({
  properties: [ 'key', 'value' ],
  methods: [
    function eval(x) {
      return x.set(this.key.eval(x), this.value.eval(x));
    }
  ]
});

var VAR = CLASS({
  properties: [ 'key' ],
  methods: [
    function eval(x) {
      return x.get(this.key.eval(x));
    }
  ]
});

var PRINT = CLASS({
  properties: [ 'expr' ],
  methods: [
    function eval(x) {
      console.log(this.expr.eval(x));
    }
  ]
});

var FRAME = CLASS({
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

console.log(LITERAL(5).eval());

console.log(EQ(LITERAL(5), LITERAL(4)).eval());

console.log(PLUS(LITERAL(5), LITERAL(4)).eval());

PRINT(PLUS(LITERAL(5), LITERAL(4))).eval();

LET(LITERAL('x'), LITERAL(42)).eval(frame);

PRINT(VAR(LITERAL('x'))).eval(frame);
