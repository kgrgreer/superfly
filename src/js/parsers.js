scope.eval$(`
'Parsers section ()

{ str pos value |
  { m |
    m switch
      'head { this | " head-> " str pos charAt + print str pos charAt }
      'tail { this | str pos 1 + 'value PStream () }
      { this | " PStream Unknown Method '" m + '' + print }
    end
  }
} :PStream

" 01234" 3 charAt print

// Access to current input:
ip_ print
// input_ print

// Parse Combinators

{ start end c | c start >=  c end <= & } :inRange
{ start end | { ps |
  start end ps.head inRange () { | ps.tail } { | false } ifelse
} } :range

{ str | { ps | 0 { i |
  { | ps.head str i charAt = } { | ps.tail :ps  i 1 + :i } while
  str len i = { | ps } { | false } ifelse
} () } } :literal

{ parsers | { ps | 0 { i |
  { | i parsers len < { | ps parsers i @ () :ps ps } && } { | i 1 + :i } while
  parsers len i = { | ps } { | false } ifelse
} () } } :seq

{ parsers | { ps | 0 false { i ret |
  { | i parsers len < { | ps parsers i @ () :ret ret not } && } { | i 1 + :i } while
  ret
} () } } :alt

{ parser min | { ps | 0 false { i ret |
  { | ps :ret  ps parser () :ps ps } { | i 1 + :i } while
  i min >=  { | ret } { | false } ifelse
} () } } :repeat

{ parser | { ps | ps { ret |
  ps parser () :ret
  ret { | 'optyes print ret } { | 'optno print ps } ifelse
} () } } :optional

{ str | { ps |
  str ps.head indexOf -1 = { | ps.tail } { | false } ifelse
} } :notChars


" thisthenthat0123 " 0 nil PStream () :ps

ps 'this literal () () print
'that print
ps 'that literal () () print


" Seq Parser" section ()
[ 'this literal () 'then literal () 'that literal () ] seq () :seqparser
ps seqparser () print


" Alt Parser" section ()
[ 'think literal () 'this literal () ] alt () :altparser
ps altparser () print


" Range Parser" section ()
'0 '9 range  () :rangeparser
ps rangeparser () print
'a 'z range  () :rangeparser
ps rangeparser () print


" Repeat Parser" section ()
'a 'z range () 1 repeat () :repeatparser
ps repeatparser () print


" Optional Parser" section ()
'this print
ps 'this literal () optional () () print
'that print
ps [ 'that literal () optional () 'this literal () ] seq () () print
'thisandthat print
ps [ 'this literal () optional () 'then literal () ] seq () () print

" NotChars Parser" section ()
ps " 0123456789" notChars () 0 repeat () () print


'Grammar section ()


// 'call    { s this | this s this () () }

{ |
  { m | m switch2
    'parse   { this | this.start } factory ()
    'start   { this | this.expr } factory ()
    'expr    { this | [ this.expr1 [ '+ literal () { | this.expr () } ] seq () optional () ] seq ()  } factory ()
    'exprOp  { this | [ '+ literal () '- literal () ] alt () } factory ()
    'expr1   { this | [ this.expr2 [ this.expr1Op { | this.expr1 () } ] seq () optional () ] seq ()  } factory ()
    'expr1Op { this | [ '* literal () '/ literal () ] alt () } factory ()
    'expr2   { this | [ this.expr3 [ this.expr2Op { | this.expr2 () } ] seq () optional () ] seq ()  } factory ()
    'expr2Op { this | '^ literal () } factory ()
    'expr3   { this | [ this.number this.group ] alt () } factory ()
    'group   { this | [ '( literal () { | this.expr () } ') literal () ] seq () } factory ()
    'number  { this | '0 '9 range () 1 repeat () } factory ()
    'digit   { this | '0 '9 range () } factory ()
    { this | " Formula Parser Unknown Method " m + print }
  end }
} :FormulaParser

'a print
" 123*(456+56)/3^2 " 0 nil PStream () :ps
'b print
FormulaParser () :formulaparser
/*
// ps formulaparser 'digit formulaparser ()  () print
'c print
// ps formulaparser.digit () print
'd print
// ps formulaparser.number () print
'e print
*/
'b print
ps formulaparser.parse () print
// ps 'test formulaparser.call () print


`);