var gulp = require('gulp'),
  sourcemaps = require('gulp-sourcemaps'),
  plumber = require('gulp-plumber'),
  babel = require('gulp-babel'),
  Cache = require('gulp-file-cache');

var cache = new Cache();

gulp.task('js', function () {
  return gulp.src('./src/**/*.js')
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(cache.filter())
    .pipe(babel({
      presets: ['es2015', 'stage-0'],
      plugins: ['transform-runtime']
    }))
    .pipe(cache.cache())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('./.dist'));
});

gulp.task('default', ['js']);
