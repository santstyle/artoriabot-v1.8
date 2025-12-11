const axios = require('axios');

module.exports = async function (sock, chatId, city) {
    try {
        const apiKey = '4902c0f2550f58298ad4146a92b65e10';  // Replace with your OpenWeather API Key
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`);
        const weather = response.data;

        const weatherText = `🌤️ *Cuaca di ${weather.name}:*\n\n✨ ${weather.weather[0].description}\n🌡️ Suhu: ${weather.main.temp}°C\n💧 Kelembaban: ${weather.main.humidity}%\n💨 Angin: ${weather.wind.speed} m/s\n\nJangan lupa bawa payung atau sunscreen ya!~`;

        await sock.sendMessage(chatId, { text: weatherText });
    } catch (error) {
        console.error('Wah, ada error waktu ambil data cuaca nih:', error);
        await sock.sendMessage(chatId, {
            text: 'Aduh, cuacanya lagi ga mau kasih tahu nih. Coba cek nama kotanya lagi ya, siapa tau ada yang keliru diketik~'
        });
    }
};