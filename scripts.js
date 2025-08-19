document.addEventListener('DOMContentLoaded', function() {
    // Example interactive element: toggle article title color on click
    document.querySelectorAll('article h2').forEach(title => {
        title.addEventListener('click', () => {
            title.style.color = title.style.color === 'red' ? '#004080' : 'red';
        });
    });

    // Form submission with validation and AJAX simulation (for the demo)
    const form = document.getElementById('contactForm');
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = {
            name: form.name.value,
            email: form.email.value,
            message: form.message.value
        };
        console.log('Form Data Submitted:', formData);
        alert('Thank you for contacting us, ' + formData.name + '!');
        form.reset();
    });
});
