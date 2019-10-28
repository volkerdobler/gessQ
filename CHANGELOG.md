# Change Log
All notable changes to the "gessq" extension will be documented in this file.

### 0.0.1
Initial release of a first version. Feedback is very welcomed.

### 0.0.2
Changed the description slightly.

### 0.0.3
Changed search-String to find only question-names and no block, screen or opennumformat statements

### 0.0.4
Fixed an error with the "Find all Reference" function

### 0.0.5
The Question-Keywords are now recognized case insensitive

### 0.0.6
Optimize syntax highlighting

### 0.0.7
further optimization of syntax highlighting

### 0.0.8
colorization of some gessq commands have been added

### 0.0.9
optimize symbol search

### 0.0.10
rewrite of symbol search to show only real questions and screens/blocks - will be extended to other commands in the future

### 0.0.11
while rewriting the symbols in version 0.0.10, some easy symbols got wrong - fixed

### 0.0.12
"group" is now recognized as variable which can be found while using the symbol search function
Closing Symbol includes now comments starting with "/*"

### 0.0.13
New snippet check_grid_open (only valid with our GN macro)

### 0.0.14
no changes

### 0.0.15
just a minor test - same as version 0.0.13

### 0.0.16
fixed an error in language-configuration.json
ShowLabelValues is now also highlighted as reserved word

### 0.0.17
add Goto Definition Provider (F12)

### 0.0.18
Goto Definition Provider (F12) is looking in all files in workspace/(sub-)folder

### 0.0.19
Add gessQ icon from www.gessgroup.de

### 0.1.0
Add "Find all References" and update to new version

### 0.1.1
First version of "Go to symbol" (CTRL-T)
Not working correctly for all possiblities of references (especially assert are 
not handle allways correctly). But it will find most of the references which 
are used in all scripts in the directory - including sub-directories.

### 0.1.2
Bug fixes in Definition Provider and Find all References.
Also minor optimizations for Go to symbol

### 0.1.3
Another bug fix in Find all References.
