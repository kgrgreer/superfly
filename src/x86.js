eval(require('fs').readFileSync(__dirname + '/sf.js', { encoding: 'utf8' }));

CLASS({
  name: 'RAX',
  methods: [
    function toBinary(x) {
      return [ 0 ];
    }
  ]
});

CLASS({
  name: 'RBX',
  methods: [
    function toBinary(x) {
      return [ 1 ];
    }
  ]
});

CLASS({
  name: 'RCX',
  methods: [
    function toBinary(x) {
      return [ 2 ];
    }
  ]
});

CLASS({
  name: 'RDX',
  methods: [
    function toBinary(x) {
      return [ 3 ];
    }
  ]
});

CLASS({
  name: 'RSP',
  methods: [
    function toBinary(x) {
      return [ 4 ];
    }
  ]
});

CLASS({
  name: 'RSI',
  methods: [
    function toBinary(x) {
      return [ 5 ];
    }
  ]
});

CLASS({
  name: 'RDI',
  methods: [
    function toBinary(x) {
      return [ 6 ];
    }
  ]
});

CLASS({
  name: 'SYSCALL',
  methods: [
    function toBinary(x) {
      return [0x0f, 0x05];
    }
  ]
});

CLASS({
  name: 'IMM64',
  properties: [
    'value'
  ],
  methods: [
    function toBinary(x) {
      // TODO: JS only support 32-bit integers with bitwise operations.
      var v = this.value;
      return [
        v & 0x000000ff,
        v & 0x0000ff00,
        v & 0x00ff0000,
        v & 0xff000000,
        0, 0, 0, 0,
      ];
    }
  ]
});

CLASS({
  name: 'IMM32',
  properties: [
    'value'
  ],
  methods: [
    function toBinary(x) {
      // TODO: JS only support 32-bit integers with bitwise operations.
      var v = this.value;
      return [
        v & 0x000000ff,
        v & 0x0000ff00,
        v & 0x00ff0000,
        v & 0xff000000,
      ];
    }
  ]
});

CLASS({
  name: 'IMM16',
  properties: [
    'value'
  ],
  methods: [
    function toBinary(x) {
      var v = this.value;
      return [
        v & 0x00ff,
        v & 0xff00,
      ];
    }
  ]
});

CLASS({
  name: 'IMM8',
  properties: [
    'value'
  ],
  methods: [
    function toBinary(x) {
      return [ this.value ];
    }
  ]
});

CLASS({
  name: 'MOV64',
  documentation: 'Move a 64-bit value into a 64-bit register.',
  properties: [
    'Expr src',
    'Expr dest'
  ],
  methods: [
    function toBinary(x) {
      // x86 instruction encoding is ridiculous complex.  Check with
      // adamvy or the AMD/Intel Programmers Manuals before changing
      // stuff. This specific encoding only support moving 64-bit
      // immediate values into a 64-bit register

      // In particular 0x48 (REX.W) would need to become 0x49 (REX.WB)
      // to address registers beyond RDI
      return [
        0x48, // REX.W - Enable 64-bit operands
        0xb8 + this.dest.toBinary(x)[0], // Opcode is B8 +rq, where rq is the destination register number.
      ].concat(this.src.toBinary(x));
    }
  ]
});

var prog = SEQ(
  MOV64(IMM64(0x3c), RAX()),  // 0x3c - exit()
  MOV64(IMM64(0), RDI()), // exit value of 0
  SYSCALL());


var textsection = Buffer.from(prog.toBinary());

var programheader = Buffer.from([
  1, // type: 1 - loadable segment
  0,
  0,
  0,
  1 + 4, // flags: bitmask of 1 - execute, 2 - write, 4 - read, most programs to 5, but we'll have some self modifying code for funsies.  might cause problems on some systems
  0,
  0,
  0,
  0, // offset into image to load from, left at 0 to load ELF header and code all at once. I tried ot just load the code section but it no work
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0, // virtual address of segment : 0x00000000 00400000
  0,
  0x40,
  0,
  0,
  0,
  0,
  0,
  0, // physical address, not relevant on most systems, set same as physical address
  0,
  0x40,
  0,
  0,
  0,
  0,
  0,
  IMM64(textsection.length).toBinary(), // size of segment on image
  IMM64(textsection.length).toBinary(), // size of segment in memory
  0,
  0,
  0x20,
  0,
  0,
  0,
  0,
  0
].flat());

var elfheader = Buffer.from([
  0x7f, // MAGIC 7f 'ELF'
  0x45,
  0x4c,
  0x46,
  0x02, // 1 - 32-bit, 2 - 64-bit
  0x01, // 1 - little-endian, 2 - big-endain
  0x01, // Version 1
  0, // OS ABI - 0 - System V
  0, // ABI Version
  0, // padding 7 bytes
  0,
  0,
  0,
  0,
  0,
  0,
  2, // type - 0002 executable
  0,
  0x3e, // ISA: 003e - AMD64
  0,
  1, // ELF Version 1
  0,
  0,
  0,
  0x78, // 0x00000000 00400078 - Entry point ( 8 bytes for 64-bit )
  0,
  0x40,
  0,
  0,
  0,
  0,
  0,
  0x40, // 0x0000000 00000040 - Program header offest 0x40 is immediate after 64-bit header
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0, // Section header offset
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0, // flags
  0,
  0,
  0,
  0x40, // size of this header
  0,
  0x38, // size of a program header
  0,
  1, // number of program headers
  0,
  0x40, // size of section headers
  0,
  0, // number of section headers
  0,
  0, // index of section header that contains section names
  0
]);

var fd = require('fs').openSync('test', 'w', 0o755);

require('fs').writeSync(fd, elfheader);
require('fs').writeSync(fd, programheader);
require('fs').writeSync(fd, textsection);
