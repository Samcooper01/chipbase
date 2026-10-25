## Why you are here

Every serious physical-design tool speaks Tcl (Tool Command Language):
you drive the tool, query the design, and automate everything through it.
This track teaches the language itself from zero, in six short steps.
By the end you can solve the interview problems in the Scripting topic.

## Lesson: the three ideas in this language

**1. Everything is a command.** A script is lines of
`commandname arg1 arg2 ...`, separated by newlines. Even "set a variable"
is a command:

```tcl
set design gcd
set cell_count 547
```

`set <name> <value>` creates (or overwrites) a variable. No declarations,
no types: **every value is a string** underneath, and that is the single
most important fact about the language.

**2. `$` substitutes a variable's value.** Write `$design` anywhere and
the value is pasted in before the command runs:

```tcl
puts $design            ;# prints: gcd
puts "design: $design"  ;# prints: design: gcd
```

`puts` prints one line. Double quotes group words into one argument
*while still substituting* `$variables` inside. Curly braces `{...}`
also group, but **prevent** substitution: `puts {design: $design}`
prints the literal text `design: $design`. Quotes when you want values,
braces when you want raw text.

**3. Comments start with `#`** at a command position. A trailing comment
on the same line needs a semicolon first: `puts hi ;# like this`.

## Task

Create two variables, `design` holding `gcd` and `cell_count` holding
`547`, then use `puts` with `$` substitution to print **exactly**:

```
design: gcd
cells: 547
gcd has 547 cells
```

The grader only sees your output, but write it with variables: the third
line should contain `$design` and `$cell_count`, not retyped text. That
is the habit that matters.
