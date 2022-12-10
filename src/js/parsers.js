scope.eval$(`
'Parsers section ()

{ str pos value |
  { m |
    m switch
      'head { this | " head-> " str pos charAt + print  str pos charAt }
      'tail { this | str pos 1 + this.head PStream () }
      'value { this | value }
      ':value { value this | str pos value PStream () }
      'toString { this | " PStream: " pos " , '" value '' + + + + }
      { this | " PStream Unknown Method '" m + '' + print }
    end
  }
} :PStream // A Parser Stream - used as input for parsers

// Access to current input:
// ip_ print
// input_ print

// Parse Combinators

{ str v | { ps | /* 'literal: str + print */ 0 { i |
  { | ps.head str i charAt = } { | ps.tail :ps  i 1 + :i } while
  str len i = { | v ps.:value } { | false } ifelse
} () } } :literalMap

{ str | str str literalMap () } :literal

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

{ parsers i |
  parsers seq () { a | a i @ } mapp ()
} :seq1

{ parsers | parsers prepare () :parsers { ps | 0 false { i ret |
  { | i parsers len < { | ps parsers i @ () :ret ret not } && } { | i 1 + :i } while
  ret
} () } } :alt

{ parser min | { ps | 0 false { i ret |
  [ { | ps :ret  ps parser () :ps ps } { | i 1 + :i ps.value } while ]
  i min >=  { a | a ret.:value } { _ | false } ifelse
} () } } :repeat

{ parser delim |
  [ [ parser delim ] 0 seq1 () 0 repeat () parser optional () ] seq ()
  { a | [ a 0 @  { e | e } forEach () a 1 @ ] } mapp ()
} :delim

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

{ p f |
  { ps | ps p () :ps ps { | ps.value f () ps.:value } { | false } ifelse }
} :mapp


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
  { o | [ l o.call [ op r o.call ] seq () optional () ] seq () }
} :bin // binary operator, ie. expr +/0 expr13

{ v |
  v 0 @
  v 1 @ { | "  " v 1 @ 1 @ "  " v 1 @ 0 @ + + + + } if
} :infix // convert an infix operator to postfix

{ o m super f | { ps | ps o m super () () f mapp () () } } :action


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence

// Just a Parser, validates but has no semantic actions
{ | 1 19 { | } for () { equality inequality expr2 expr3 expr4 expr8 expr9 expr11 expr12 expr13 expr17 expr18 group number digit bool and or array | // Improve with 'let' support
  [ '== '= literalMap () '!= ] alt ()         :equality
  [ '<= '< '>= '> ] alt ()                    :inequality
  '&& literal ()                              :and
  '|| literal ()                              :or
  { o | [ o.expr3 [ '? o.expr3 ': o.expr3 ] seq () optional () ] seq () } :expr2 // TODO: what should the second two expressions be?
  'expr4 or 'expr3  bin ()                                  :expr3
  'expr5 and 'expr4 bin ()                                  :expr4
  'expr9 equality 'expr8  bin ()                            :expr8
  'expr10 inequality 'expr9  bin ()                         :expr9
  'expr12 '+- anyChar () 'expr11  bin ()                    :expr11
  'expr13 '*/%  anyChar () 'expr12  bin ()                  :expr12
  'expr14 '** '^ literalMap () 'expr13 bin ()               :expr13 // TODO: fix, I think it should be right-associative
  { o | [ '! literal () optional () o.expr15 ] seq () }                :expr14
  { o | [ o.expr18 [ '[ o.expr '] ] 1 seq1 () 1 repeat () optional () ] seq () } :expr17
  { o | [ o.number o.bool o.group o.array ] alt () }        :expr18
  { o | [ '( o.expr ') ] 1 seq1 () }                        :group
  { o | o.digit 1 repeat () }                               :number
  { o | '0 '9 range () }                                    :digit
  { o | [ 'true 'false ] alt () }                           :bool
  { o | [ '[ o.expr ', literal () delim () '] ] 1 seq1 () } :array


  { m | m switch
    'parse$     { s o | s 0 nil PStream () o.start () { r | r.value } () }
    'call       { m o | o m o () () }
    'start      { o | o.expr }
    'expr       { o | o.expr2 }
    'expr2      expr2
    'expr3      expr3
    'expr4      expr4
    'expr5      { o | o.expr8 }
    'expr8      expr8
    'expr9      expr9
    'expr10     { o | o.expr11 }
    'expr11     expr11
    'expr12     expr12
    'expr13     expr13
    'expr14     expr14
    'expr15     { o | o.expr17 }
    'expr17     expr17
    'expr18     expr18
    'group      group
    'number     number
    'array      array
    'bool       bool
    'digit      digit
    'inequality inequality
    'equality   equality
    { o | " Formula Parser Unknown Method " m + print }
  end }
} () } :FormulaParser


// Add semantic actions to parser to create a JS to T0 compiler
{ | FormulaParser () { super |
  // TODO: factor out common actions
  { m | '****: m + print m switch
    'super  { m o | o m super () () () }
    'expr2  { | m super { a | a 1 @ { | [ a 0 @ "  { | " a 1 @ 1 @ "  } { | " a 1 @ 3 @ "  } ifelse" ] join () } { | a 0  @ } ifelse }  action () }
    'expr3  { | m super { a | a 1 @ { | [ a 0 @ [ a 1 @ 0 @ " { | " a 1 @ 1 @ "  }" + + ] ] } { | a } ifelse  infix () }  action () }
    'expr4  { | m super { a | a 1 @ { | [ a 0 @ [ a 1 @ 0 @ " { | " a 1 @ 1 @ "  }" + + ] ] } { | a } ifelse  infix () }  action () }
    'expr8  { | m super infix action () }
    'expr9  { | m super infix action () }
    'expr11 { | m super infix action () }
    'expr12 { | m super infix action () }
    'expr13 { | m super infix action () }
    'expr14 { | m super { a | a 1 @ a 0 @ { | "  not" + } if } action () }
    'expr17 { | m super  { a | a 0 @ a 1 @ { | "  " + a 1 @ { e |  e + "  @ " + } forEach () } if } action () }
    'number { | m super join  action () }
    'array { | m super  { a | " [" a { e | "  " + e + } forEach () "  ]" + } action () }
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



" 1+2*3 "          jsEval ()
" 5*2**(2+3)+100 " jsEval ()
" 1<2 "            jsEval ()
" 1>2 "            jsEval ()
" 1>2||1<2 "       jsEval ()
" [1,[1,2],3][1][0] " jsEval ()
" [[1,0],[0,1]][1][1]+((99<=99?1:0)+1)>2||1<2&&5==3&&!true " jsEval ()







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
