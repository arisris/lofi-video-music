## Overview

User input manual kolom textarea lirik.

Contoh raw text lirik:

```txt
Lampu-lampu kota berpijar membelah malam
Namun jiwaku terkubur dalam sunyi yang kelam
Di antara riuh suara yang memekakkan telinga
Hanya bayangmu yang kulihat nyata di pelupuk mata

Kupaksakan bibir ini mengukir seutas tawa
Meski batin meronta dalam balutan duka
Kau di sana telah melukis kisah yang baru
Sedangkan aku di sini masih terpaku pada masa lalu

Aku tersesat di balik gemerlap dunia yang fana
Membawa luka yang tak kunjung menemukan muara
Hancur berkeping hati yang dulu kau puja-puja
Kini kau bahagia, sedang aku merana dalam hampa

Dulu jemarimu mengusap peluh di keningku
Kini tanganmu menggenggam erat cinta yang baru
Setiap detak jantungku memanggil namamu lirih
Namun yang kudengar hanyalah gema perih yang letih
```

Setelah user selesai mengedit raw lirik kemudian user berpindah tab ke sync mode.
Gambaran ui tab:

|SYNC|RAW|LRC|

UI SYNC disini digunakan untuk singkronisasi manual, RAW: input raw textarea, LRC: Isi dari raw file lrc ini auto generated setelah user SYNC lirik dan juga bisa secara manual di edit langsung disini.

**Flow"

1. **User input** (raw, lrc) jika raw kolom input lrc kosong dulu, jika lrc kolom raw terformat ke newline kolom input lrc ada.
2. **User sync** Jika kondisi nya user pertama kali input raw lirik pastinya durasi start/end time setiap line nya itu kosong makanya disini kita butuh user untuk singkronisasi nya begini: Satu tombol toggle sync interaktif "Start (line x)|End (line x)" hanya aktif jika musik sedang diputar di timeline. fokus line secara otomatis berdasarkan start/end.
