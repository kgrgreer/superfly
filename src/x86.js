if ( typeof process !== 'undefined' ) {
  eval(require('fs').readFileSync(__dirname + '/sf.js', { encoding: 'utf8' }));
}

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
    'BigInt value'
  ],
  methods: [
    function toBinary(x) {
      var v = this.value;
      return [
        Number(v & 0xffn),
        Number(( v >> 8n ) & 0xffn),
        Number(( v >> 16n ) & 0xffn),
        Number(( v >> 24n ) & 0xffn),
        Number(( v >> 32n ) & 0xffn),
        Number(( v >> 40n ) & 0xffn),
        Number(( v >> 48n ) & 0xffn),
        Number(( v >> 56n ) & 0xffn)
      ];
    }
  ]
});

CLASS({
  name: 'IMM32',
  properties: [
    'value',
  ],
  methods: [
    function toBinary(x) {
      var v = this.value;
      return [
        v & 0xff,
        ( v >> 8 ) & 0xff,
        ( v >> 16 ) & 0xff,
        ( v >> 24 ) & 0xff
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
        v & 0xff,
        ( v >> 8 ) & 0xff
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

CLASS({
  name: 'ElfHeader',
  properties: [
    'IMM32 magic',
    'IMM8 cpu',
    'IMM8 endianness',
    'IMM8 version1',
    'IMM8 osAbi',
    'IMM64 abiVersion', // technically just 1 byte with 7 bytes of padding, but what do we care
    'IMM16 type',
    'IMM16 isa',
    'IMM32 version2',
    'IMM64 entryPoint',
    'IMM64 programHeaderOffset',
    'IMM64 sectionHeaderOffset',
    'IMM32 flags',
    'IMM16 mySize',
    'IMM16 programHeaderSize',
    'IMM16 programHeaderCount',
    'IMM16 sectonHeaderSize',
    'IMM16 sectionHeaderCount',
    'IMM16 sectionNamesHeaderIndex'
  ]
});

CLASS({
  name: 'ElfProgramHeader',
  properties: [
    'IMM32 type',
    'IMM32 flags',
    'IMM64 offset',
    'IMM64 virtualAddress',
    'IMM64 physicalAddress',
    'IMM64 segmentFileSize',
    'IMM64 segmentMemorySize',
    'IMM64 alignment'
  ]
});

const ELF_MAGIC = IMM32(0x464c457f);
const ELF_LOADABLE_SEGMENT = IMM32(1);
const ELF_EXECUTABLE = IMM16(2);
const ELF_ISA_AMD64 = IMM16(0x3e);
const ELF_ISA_X86 = IMM16(3);

function flatten(array) {
  return array.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val) : val), []);
}

function link(prog) {
  var code = prog.toBinary().flat();

  var header =  ElfProgramHeader(
    ELF_LOADABLE_SEGMENT,
    1 + 2 + 4, // flags X + W + R
    0,
    0x400000n,
    0x400000n,
    code.length + 0x38 + 0x40, // code size + ELF Header + Program Header
    code.length + 0x38 + 0x40, // code size + ELF Header + Program Header
    0x200000n, // alignment
  );
  var elf = ElfHeader(
    ELF_MAGIC,
    2, // 64-bit
    1, // little-endian
    1, // version
    0, // OS ABI - System V
    0, // ABI Version
    ELF_EXECUTABLE,
    ELF_ISA_AMD64,
    1, // version
    0x400078n,
    0x40,
    0,
    0,
    0x40,
    0x38,
    1, // 1 program header
    0x40, // size of section headedrs
    0, // # of section headers
    0 // no section header names section either
  );

  console.log(elf.toBinary());

  return Buffer.from(flatten([
    elf.toBinary(),
    header.toBinary(),
    code
  ]));
}


var prog = SEQ(
  MOV64(IMM64(0x3c), RAX()),  // 0x3c - exit()
  MOV64(IMM64(0), RDI()), // exit value of 0
  SYSCALL());

var fd = require('fs').openSync('test.linux', 'w', 0o755);
require('fs').writeSync(fd, link(prog));
