# FormaFit

Your body. Your strength. Your progress.

An installable personal fitness PWA for logging food, protein, water, sleep, workouts and body measurements. It has no built-in data: you enter your profile on first launch, and your calorie, protein and water targets are calculated from it (Mifflin-St Jeor). You can edit everything later in **Profile**, and set your own targets to replace the calculated ones.

Data is stored only in your browser (`localStorage`). Use **Profile → Export backup** to save a copy.

## Run locally

```sh
python -m http.server 8080
```

Then open http://localhost:8080.

## Install on a phone

Host the folder on any HTTPS static host (GitHub Pages, Netlify, Vercel). Then open it in your phone's browser and choose **Add to Home Screen** or **Install app**.

## Credits

Exercise instructions and muscle data are from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense, public domain).
