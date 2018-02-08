var app = new Vue({
    el: '#app',
    data: {
        name: '',
        invalid: ' '
    }
})

document.getElementById('button').addEventListener('click', function(e) {
    e.preventDefault();
    if (app.name.trim() === ' ' || app.name === '') {
        app.invalid = 'Empty'
    } else if (app.name.length >= 12) {
        app.invalid = 'Name should shorter than 12 characters'
    } else {
    	var form = document.getElementById('form');
        form.method = "post";
        form.action = '/login';
        form.submit();
    }
})