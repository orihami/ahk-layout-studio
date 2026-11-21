#Requires AutoHotkey v2.0

; 送ったキーをほかのスクリプトにも届ける
#InputLevel 1

$^v::{
    Send("^v")   ; 通常のペースト
}

; --- 単体 ---
,::m
m & f:::
m & g::;
+sc027::Send(">")
@::b
$sc028::Send("-")
CapsLock::Ctrl

; --- v レイヤー ---
v & i::Up
v & j::Left
v & k::Down
v & l::Right
v & o::BackSpace
v & Shift::0
v & f::^t
v & ,::^Enter
v & sc028::end

$m::{
    KeyWait("m")
    if (A_PriorKey = "m") {
        Send(",")
    }
}

$v::{
    KeyWait("v")
    if (A_PriorKey = "v") {
        Send("v")
    }
}

; --- m レイヤー ---
m & q::!
m & w::SendText Chr(34) ; "
m & h::=
m & ,::+
m & p::Send "「」"
m & sc027::  Send("{{}}")
m & sc028::`

$/:: {
    KeyWait("/")
    if (A_PriorKey = "/")
        Send("/")
}

sc028 & q::Send "{F2}"
sc028 & a::Send "{Delete}"
b::space

MyHelper() {
    MsgBox "手書きの関数"
}

/*
$*b:: {
    Send "{Shift Down}"
}
*/
