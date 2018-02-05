const gulp = require('gulp');

gulp.task('default',()=>{
	console.log('default')
})
gulp.task('css-prefix',()=>{
	const postcss      = require('gulp-postcss');
    const sourcemaps   = require('gulp-sourcemaps');
    const autoprefixer = require('autoprefixer');

    return gulp.src('./public/stylesheets/*.css')
        .pipe(sourcemaps.init())
        .pipe(postcss([ autoprefixer() ]))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('./public/stylesheets/dist'));
})

gulp.task('css-prefix-watch',()=>{
	const postcss      = require('gulp-postcss');
    const sourcemaps   = require('gulp-sourcemaps');
    const autoprefixer = require('autoprefixer');
	return gulp.watch('./public/stylesheets/*.css',()=>{
		return gulp.src('./public/stylesheets/*.css')
        .pipe(sourcemaps.init())
        .pipe(postcss([ autoprefixer() ]))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('./public/stylesheets/dist'));
	})
})