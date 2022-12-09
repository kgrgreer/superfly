scope.eval$(`
'Parsers section ()

{ str pos value |
  { m |
    m switch
      'head { this | /* " head-> " str pos charAt + print */ str pos charAt }
      'tail { this | str pos 1 + this.head PStream () }
      'value { this | value }
      ':value { value this | str pos value PStream () }
      'toString { this | " PStream: " pos " , '" value '' + + + + }
      { this | " PStream Unknown Method '" m + '' + print }
    end
  }
} :PStream // A Parser Stream - used as input for parsers

" 01234" 3 charAt print

// Access to current input:
// ip_ print
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

{ v |
  v 0 @
  v 1 @ { | "  " v 1 @ 1 @ "  " v 1 @ 0 @ + + + + } if
} :infix // convert an infix operator to postfix

{ o m super f |
  { ps | ps o m super () () () :ps ps { | ps.value f () ps.:value } { | ps } ifelse }
} :action


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence

{ | 0 0 0 0 { expr3 group number digit |
  { o | [ o.number o.group ] alt () }      :expr3
  { o | [ '( { | o.expr () } ') ] seq () } :group
  { o | o.digit 1 repeat () }              :number
  { o | '0 '9 range () }                   :digit

  { m | m switch
    'parse$ { s o | s 0 nil PStream () o.start () { r | r.value } () }
    'call   { m o | o m o () () }
    'start  { o | o.expr }
    'expr   i[ 'expr1 " +-"  'expr  bin () emit ]
    'expr1  i[ 'expr2 " */%" 'expr1 bin () emit ]
    'expr2  i[ 'expr3 '^     'expr2 bin () emit ]
    'expr3  expr3
    'group  group
    'number number
    'digit  digit
    { o | " Formula Parser Unknown Method " m + print }
  end }
} () } :FormulaParser


{ | FormulaParser () { super |
  { m | m switch
    'super  { m o | o m super () () () }
    'expr   { | m super infix action ()  }
    'expr1  { | m super infix action ()  }
    'expr2  { | m super infix action ()  }
    'group  { | m super { a | a 1 @ } action () }
    'number { | m super { a | " " a { c | c + } forEach () } action () }
    { o | o m super () () }
  end }
} () } :FormulaCompiler


{ code |
  FormulaCompiler () { compiler | code compiler.parse$ } ()
  { result |
    " " print
    " JS Code: " code   + print
    " T0 Code: " result + print
    result eval { v |
      " Result: " v + print
      v
    } ()
  } ()
} :jsEval


" 1+2*3 "         jsEval ()
" 5*2^(2+3)+100 " jsEval ()











/*
" 5*2^(2+3)+100 " 0 nil PStream () :ps

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


`);
