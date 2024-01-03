# Change Log

All notable changes to the "gessq" extension will be documented in this file.
Current version number is first:

### 0.3.6

Minor bug fix in 0.3.5

### 0.3.5

New Syntax file - thanks to Sebastian Zagaria from GessGroup
Update npm packages

### 0.3.4

Insert new feature: working with folding regions

Bug fix in finding a variable definition

### 0.3.3

Bug fixes: [Issue02](https://github.com/volkerdobler/gessQ/issues/2#issue-1126976954) & [Issue03](https://github.com/volkerdobler/gessQ/issues/3#issue-1126994849)
Thanks to [@dietzste](https://github.com/dietzste)

### 0.3.2

Bug fix: [Issue01](https://github.com/volkerdobler/gessQ/issues/1#issue-1087885595)
Double-Quotes preceded with a Backslash will no longer recognized as start of a string.

Update: insert new commands in language file

### 0.3.1

Update: insert new command "JsonDataLimit" in language file

### 0.3.0

Update: new order of SymbolProviders

### 0.2.5

Bug fix: WorkspaceSymbolProvider did not work correctly.

### 0.2.4

Bug fix: wrong regexp in actionBlockRe

### 0.2.3

Bug fix: minimum length of variable names had been 2. Reduced to 1

### 0.2.2

Bug fix: Word boundary in getWordDefinition did not work with quotations.

### 0.2.1

Bug fix of block comment chars
Bug fix in getWordDefinition to include word boundaries

### 0.2.0

New scope identification - now comments and strings are much better recognized to identify variable definitions or references

### 0.1.8

Bugfix to work with project manager and subdirectories

### 0.1.7

Bugfix in snippets - preAssertionActionBlock was wrong spelled

### 0.1.6

Added opennumformat to find symbols definition or references

### 0.1.5

Fixed a bug that references are found case insensitive

### 0.1.4

Fixed a bug to identify comments correctly.

### 0.1.3

Another bug fix in Find all References.

### 0.1.2

Bug fixes in Definition Provider and Find all References.
Also minor optimizations for Go to symbol

### 0.1.1

First version of "Go to symbol" (CTRL-T)
Not working correctly for all possibilities of references (especially assert are
not handle allways correctly). But it will find most of the references which
are used in all scripts in the directory - including sub-directories.

### 0.1.0

Add "Find all References" and update to new version

### 0.0.19

Add gessQ icon from www.gessgroup.de

### 0.0.18

Goto Definition Provider (F12) is looking in all files in workspace/(sub-)folder

### 0.0.17

add Goto Definition Provider (F12)

### 0.0.16

fixed an error in language-configuration.json
ShowLabelValues is now also highlighted as reserved word

### 0.0.15

just a minor test - same as version 0.0.13

### 0.0.14

no changes

### 0.0.13

New snippet check_grid_open (only valid with our GN macro)

### 0.0.12

"group" is now recognized as variable which can be found while using the symbol search function
Closing Symbol includes now comments starting with "/\*"

### 0.0.11

while rewriting the symbols in version 0.0.10, some easy symbols got wrong - fixed

### 0.0.10

rewrite of symbol search to show only real questions and screens/blocks - will be extended to other commands in the future

### 0.0.9

optimize symbol search

### 0.0.8

colorization of some gessq commands have been added

### 0.0.7

further optimization of syntax highlighting

### 0.0.6

Optimize syntax highlighting

### 0.0.5

The Question-Keywords are now recognized case insensitive

### 0.0.4

Fixed an error with the "Find all Reference" function

### 0.0.3

Changed search-String to find only question-names and no block, screen or opennumformat statements

### 0.0.2

Changed the description slightly.

### 0.0.1

Initial release of a first version. Feedback is very welcomed.
