scope.eval$(`
'Parsers section ()

{ str pos value |
  { m |
    m switch
      'head { this | " head-> " str pos charAt + print str pos charAt }
      'tail { this | str pos 1 + this.head PStream () }
      'value { this | value }
      ':value { value this | str pos value PStream () }
      'toString { this | " PStream: " pos " , '" value '' + + + + }
      { this | " PStream Unknown Method '" m + '' + print }
    end
  }
} :PStream

" 01234" 3 charAt print

// Access to current input:
ip_ print
// input_ print

// Parse Combinators

{ str | { ps | 0 { i |
  { | ps.head str i charAt = } { | ps.tail :ps  i 1 + :i } while
  str len i = { | str ps.:value } { | false } ifelse
} () } } :literal

{ start end c | c start >=  c end <= & } :inRange
{ start end | { ps |
  start end ps.head inRange () { | ps.tail } { | false } ifelse
} } :range

{ parsers |
  parsers { p | p string? { | p literal () } { | p } ifelse } map ()
} :prepare

{ parsers | parsers prepare () :parsers { ps | 0 { i |
  [ { | i parsers len < { | ps parsers i @ () :ps ps } && } { | i 1 + :i ps.value } while ]
  parsers len i = { a | a ps.:value } { _ | false } ifelse
} () } } :seq

{ parsers | parsers prepare () :parsers { ps | 0 false { i ret |
  { | i parsers len < { | ps parsers i @ () :ret ret not } && } { | i 1 + :i } while
  ret
} () } } :alt

{ parser min | { ps | 0 false { i ret |
  [ { | ps :ret  ps parser () :ps ps } { | i 1 + :i ps.value } while ]
  i min >=  { a | a ret.:value } { _ | false } ifelse
} () } } :repeat

{ parser | { ps | ps { ret |
  ps parser () :ret
  ret { | ret } { | false ps.:value } ifelse
} () } } :optional

{ str | { ps |
  str ps.head indexOf -1 = { | ps.tail } { | false } ifelse
} } :notChars

{ str | { ps |
  str ps.head indexOf -1 > { | ps.tail } { | false } ifelse
} } :anyChar




// ///////////////////////////////////////////////////////////// Parser Tests

" thisthenthat0123 " 0 nil PStream () :ps

" Literal Parser" section ()
ps 'this literal () () print
'that print
ps 'that literal () () print
ps 'this literal () () :result
result.toString print


" Seq Parser" section ()
[ 'this 'then 'that ] seq () :seqparser
ps seqparser () :result
result.toString print


" Alt Parser" section ()
[ 'think 'this ] alt () :altparser
ps altparser () :result
result.toString print


" Range Parser" section ()
'0 '9 range  () :rangeparser
ps rangeparser () print
'a 'z range  () :rangeparser
ps rangeparser () :result
result.toString print

" Repeat Parser" section ()
'a 'z range () 1 repeat () :repeatparser
ps repeatparser () :result
result.toString print


" Optional Parser" section ()
'this print
ps 'this literal () optional () () :result
result.toString print

'that print
ps [ 'that literal () optional () 'this ] seq () () :result
result.toString print

'thisthen print
ps [ 'this literal () optional () 'then ] seq () () :result
result.toString print


" NotChars Parser" section ()
ps " 0123456789" notChars () 0 repeat () () :result
result.toString print


'Grammar section ()

{ l op r |
  { this |
    [ { | l this.call } () [ op anyChar () { | r this.call () } ] seq () optional () ] seq ()
  }
} :bin // binary operator, ie. expr +/0 expr2


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence

{ | { m | m switch2
  'name   { o | 'XXXParser }
  'test   { o | 'hello print }
  'call   { m o | o m o () () }
  'parse  { o | o.start }
  'start  { o | o.expr }
  'expr   'expr1 " +-"  'expr  bin ()
  'expr1  'expr2 " */%" 'expr1 bin ()
  'expr2  'expr3 '^     'expr2 bin ()
  'expr3  { o | [ o.number o.group ] alt () } factory ()
  'group  { o | [ '( { | o.expr () } ') ] seq () } factory ()
  'number { o | 'zzz print o.digit 1 repeat () } factory ()
  'digit  { o | '0 '9 range () } factory ()
  { o | " Formula Parser Unknown Method " m + print }
end } } :FormulaParser

// " 123*(456+56)/3^2 " 0 nil PStream () :ps
" 1+2 " 0 nil PStream () :ps

/*
'a print
'b print
FormulaParser () :formulaparser
// ps formulaparser 'digit formulaparser ()  () print
'c print
// ps formulaparser.digit () print
'd print
// ps formulaparser.number () print
'e print
'b print
ps formulaparser.parse () :result
result.toString print

// ps 'test formulaparser.call () print
result.value
*/

//     { v | v 0 @ "  " v 2 @ "  " v 1 @ "  " + + + + + } action ()

{ s f |
  { ps | ps s () { | /* ps.value f () */ 'foobar ps.:value } { | ps } ifelse }
} :xxxaction

{ v |
  'v0: v 0 @ + print
  'v1: v 1 @ + print
  debugger
  v 0 @ "  " +
  v 1 @
    { |
      'v0,1: v 1 @ 1 @ + print
      'v0,0: v 1 @ 0 @ + print

       v 1 @ 1 @ "  " v 1 @ 0 @ "  " + + + + }
    if
} :infix

{ ps f |
  ps { | ps.value f () ps.:value } { | ps } ifelse
} :action

{ | FormulaParser () { super |
  { m | m switch
    'name { o | 'XXXCompiler }
    'test   { o | super.test 'there print }
    'expr   { o | { ps | ps super.expr () infix action () } }
    'expr1  { o | { ps | ps super.expr1 () infix action () } }
    'expr2  { o | { ps | ps super.expr2 () infix action () } }
    'group  { o | { ps | ps super.group () { a | a 1 @ } action () } }
    'number { o | { ps | ps super.number () { a | " " a { c | c + } forEach () } action () } }
    { o | m print o m super () () }
  end }
} () } :FormulaCompiler

FormulaCompiler () :compiler
'compiler print

// compiler.number
compiler.test

'a print
ps compiler.parse () :result
'b print


result.toString print


`);
