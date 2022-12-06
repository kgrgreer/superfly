// Tests
scope.eval$(`
// Build a Tester class to perform tests and record statistics
{ |
  0 0 { passed failed |
    { m |
      m switch
        'score { f this |
          f { | passed 1 + :passed " PASSED" } { | failed 1 + :failed " FAILED" } ifelse
        }
        'test { script answer this |
          " Expect: " script "  -> " answer "  " + + + +
          script eval answer = this.score + print
        }
        'report { this |
          " " print
          " Tests Run: " passed failed + + print
          "    PASSED: " passed + print
          "    FAILED: " failed + print
          " " print
        }
        { this | " unknown method: " m + print }
      end
    }
  } ()
} :Tester

// Create an instance of Tester
Tester () :t


'Arithmetic section ()
" 1 1 +" 2 t.test
" 0 1 +" 1 t.test
" 2 1 -" 1 t.test
" 0 6 -" -6 t.test
" 4 2 *" 8 t.test
" 4 2 /" 2 t.test
" 10 3 mod" 1 t.test
" 2 8 ^" 256 t.test
" 15 %" 0.15 t.test
" 15 10 10 ^ *" 150000000000 t.test // scientific notation, distance from earth to sun in meters
" 5 neg ()" -5 t.test // it's inconsistent that some operators require () and others don't


'Comparators section ()
" 1 1 ="  true  t.test
" 1 2 ="  false t.test
" 1 1 !=" false t.test
" 1 2 !=" true  t.test
" 1 2 < " true  t.test
" 2 1 < " false t.test
" 2 2 <=" true  t.test
" 2 3 <=" true  t.test


'Logic section ()
" false not" true  t.test
" true not"  false t.test

" false false |"  false t.test
" false true  |"  true  t.test
" true  false |"  true  t.test
" true  true  |"  true  t.test

" false false &"  false t.test
" false true  &"  false t.test
" true  false &"  false t.test
" true  true  &"  true  t.test

" false { | false } &&"  false t.test
" false { | true }  &&"  false t.test
" true  { | false } &&"  false t.test
" true  { | true }  &&"  true  t.test

" false { | false } ||"  false t.test
" false { | true }  ||"  true  t.test
" true  { | false } ||"  true  t.test
" true  { | true }  ||"  true  t.test

" true false | true false & |" true t.test


'Functions section ()
{ a | a print } :A
4 A ()
{ b | b A () } :B
5 B ()

{ | " inline function" print } ()

{ | " Hello world!" print } :helloWorld
helloWorld ()

{ a | a a + } :double
2 double () double () print


" Functions as Parameters" section ()
{ f | " running callFiveTimes" print f f f f f i[ " compiling callFiveTimes" print ] () f () f () f () f () } :callFiveTimes
helloWorld callFiveTimes ()


" Own Variables" section ()
// a precursor to OO
1 { count |
  { | count 1 + :count count }
} () :counter

counter () print
counter () print
counter () print


'OO section ()
// Create a Lisp-like CONS operator, but use head/tail instead of car/cdr
// Is a simple class.
{ h t |
  { m |
    m switch
      'head { | h } ':head { v | v :h }
      'tail { | t } ':tail { v | v :t }
      { | }
    end ()
  }
} :cons

'car 'cdr cons () :c // construct a cons
'head c () print
'tail c () print
1 ':head c ()
2 ':tail c ()
'head c () print
'tail c () print

// Now a more featured OO system with 'this' 'super' and inheritance
{ x y r |
  { m |
    m switch
      'class { t | Ball }
      'x { t | x } ':x { v | v :x }
      'y { t | y } ':y { v | v :y }
      'r { t | r } ':r { v | v :r }
      'toString { t | x ', y ', r + + + + }
      { t | " unknown method" print }
    end
  }
} :Ball

5 4 3 Ball () :b1
b1.x print
b1.toString print


10 19 5 Ball () :b2
b2.toString print

{ c | Ball () { super |
  { m | m switch
    'class { this | ColourBall }
    'c { this | c } ':c { v | v :c }
    'toString { this | super.toString ', c + + }
    { this | m this super () }
  end }
} () } :ColourBall // This would also work and be faster:   } () } 'ColourBall const

6 5 2 'red ColourBall () :b3
b3.c print
b3.toString print

7 7 1 'green b3.class () :b4
b4.toString print

/*
// The above code is the equivalent to this in a more regular syntax:

class ColourBall extends Ball {
  var c;
  ColourBall(..., c) {
    super(...);
    this.c = c;
  }
  getC() { return c; }
  setC(v) { c = v; }
  toString() { return super.toString() + ", " + c_; }
}
*/


'Recursion section ()
{ n | n 1 <= { | 1 } { | n n 1 - fact () * } ifelse } :fact
" 20 fact ()" 2432902008176640000 t.test

{ f | { x | { y | y x x () () } f () } { x | x x () } () } :Y // y-combinator
{ f | { n | n 1 <= { | 1 } { | n n 1 - f () * } ifelse } } Y () :fact2

" 10 fact2 ()" 3628800 t.test

" Lexical Scoping" section ()
1 { a | { | a print } () } ()

" hello world"  { a | { | a print } } () :sayhello
sayhello () sayhello ()

" 3 deep"  { a | { | { | a print } } } () () ()


'Variables section ()
3 14 100 / + :PI // PI = 3.14, need to do this way until doubles are supported
PI print
PI 2 * print

1 { i |
  i print
  i 1 + :i i print
  i 1 + :i i print
  i 1 + :i i print
  i 1 + :i i print
  i 1 + :i i print
  i 1 + :i i print
  i 1 + :i i print
} ()


'Conditionals section ()
true  { | " is true"  print } if
false { | " is false" print } if

true  { | " if true" print } { | " if false" print } ifelse
false { | " if true" print } { | " if false" print } ifelse


'Eval section ()
" 1 + 2 print" eval

{ script answer |
  " Expect: " script "  -> " answer "  " + + + +
  script eval answer = + print
} :expect

" 1 2 +" 3 expect ()
" 1 2 +" 4 expect ()


'Looping section ()
1 { i |
  { | i 10 <= } { | " loop: " i + print i 1 + :i } while
} ()

5 15 { i | " for: " i + print } for ()


'Nil section ()
" nil nil =" true  t.test
" nil 5   =" false t.test


'Switch section ()
3 switch
  1 { | " one"   }
  2 { | " two"   }
  3 { | " three" }
  { | " unknown" }
end () print

{ n | n
  switch
    1 " un"
    2 " deus"
    3 " trois "
    " unknown"
  end
} :lookupNumber
2 lookupNumber () print
7 lookupNumber () print


'Const section ()
3.1415926 'PI const
" PI" 3.1415926 t.test
PI print


'Arrays section ()
10 'hello []WithValue :hellos
hellos print
" good bye" hellos 5 :@
hellos print
16 { i | 2 i ^ } []WithFn :powersOf2
powersOf2 print
powersOf2 4 @ print
[ 1 2 3 'abc " def" true false ] print

{ | 'thinking print 42 } factory () :meaning
meaning () print
meaning () print

// Code evaulation at compile-time:
{ | i[ 'fooing print 1 2 + emit ] } :foo

foo () print
foo () print
foo () print

{ | i[ 'baring print { x | x 2 * } emit ] } :bar

1 bar () () print
2 bar () () print
3 bar () () print


t.report
`);
