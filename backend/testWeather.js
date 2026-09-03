require('dotenv').config();

const apiKey = process.env.WEATHER_API_KEY;
console.log("KEY IS:", JSON.stringify(apiKey));
const city = "Lahore";

const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    console.log("Weather data received:");
    console.log(data);
  })
  .catch(err => {
    console.error("Error fetching weather:", err);
  });