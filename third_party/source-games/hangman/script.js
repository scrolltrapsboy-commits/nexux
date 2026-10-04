const hangmanImage = document.querySelector(".hangman-box img");
const wordDisplay = document.querySelector(".word-display");
const guessesText = document.querySelector(".guesses-text b");
const keyboardDiv = document.querySelector(".keyboard");
const gameModal = document.querySelector(".game-modal");
const playAgainBtn = document.querySelector(".play-again");

let currentWord, correctLetters, wrongGuessCount;
let gameOverFlag = false;
const maxGuesses = 6;

// Reset all game variables and UI elements
const resetGame = () => {
    correctLetters = [];
    wrongGuessCount = 0;
    hangmanImage.src = `images/hangman-${wrongGuessCount}.svg`;
    guessesText.innerText = `${wrongGuessCount} / ${maxGuesses}`;
    keyboardDiv.querySelectorAll("button").forEach(btn => btn.disabled = false);
    // Turn each letter into an empty space
    wordDisplay.innerHTML = currentWord.split("").map(() => `<li class="letter"></li>`).join("");
    gameModal.classList.remove("show");

    // Retrieve the score from localStorage and convert it to a number
    score = Number(localStorage.getItem('score')) || 0;
};

// Temporary word list that will be replenished once all words have been guessed
let wordListCopy = JSON.parse(localStorage.getItem('wordListCopy')) || [...wordList];

const getRandomWord = () => {
    gameOverFlag = false;
    // If all words have been used, refresh the word list
    if (wordListCopy.length === 0) {
        wordListCopy = [...wordList];
    }

    // Check if wordListCopy is not empty
    if (wordListCopy.length > 0) {
        // Select a random index from wordListCopy
        const randomIndex = Math.floor(Math.random() * wordListCopy.length);

        // Check if the element at randomIndex is defined
        if (wordListCopy[randomIndex]) {
            // Select a random word and hint from wordListCopy
            const { word, hint } = wordListCopy[randomIndex];
            currentWord = word;
            console.log(word);
            document.querySelector(".hint-text b").innerText = hint;

            // Remove the selected word from wordListCopy
            wordListCopy.splice(randomIndex, 1);
        } else {
            console.error('Element at randomIndex is undefined');
            return; // Return early to prevent resetGame from being called
        }
    } else {
        console.error('wordListCopy is empty');
        return; // Return early to prevent resetGame from being called
    }

    // Save the updated wordListCopy in local storage
    localStorage.setItem('wordListCopy', JSON.stringify(wordListCopy));

    resetGame();
};

// Retrieve the score from localStorage when the page is loaded
let score = Number(localStorage.getItem('score')) || 0;

const gameOver = (isVictory) => {
    gameOverFlag = true;
    // After 600ms of completing the game, show the relevant modal
    setTimeout(() => {
        const modalText = isVictory ? `You found the word: ` : `The correct word was: `;
        gameModal.querySelector("img").src = `images/${isVictory ? "victory" : "lost"}.gif`;
        gameModal.querySelector("h4").innerText = `${isVictory ? "Congrats!" : "Game Over!"}`;
        gameModal.querySelector("p").innerHTML = `${modalText} <b>${currentWord}</b>`;

        if (isVictory) {
            score += 100;
        } else {
            score = 0; // Reset score to 0 if the game is lost
        }

        // Store the score in localStorage
        localStorage.setItem('score', score);

        gameModal.querySelector(".score-display").innerText = `Score: ${score}`;

        gameModal.classList.add("show");
    }, 300);
};

const initGame = (button, clickedLetter) => {
    // Check if clickedLetter is in currentWord
    if (currentWord.includes(clickedLetter)) {
        // Show all correct letters on the word display
        [...currentWord].forEach((letter, index) => {
            if (letter === clickedLetter) {
                correctLetters.push(letter);
                wordDisplay.querySelectorAll("li")[index].innerText = letter;
                wordDisplay.querySelectorAll("li")[index].classList.add("guessed");
            }
        });
    }
    else {
        // If clickedLetter isn't in currentWord, update wrongGuessCount and hangmanImage
        wrongGuessCount++;
        hangmanImage.src = `images/hangman-${wrongGuessCount}.svg`;
    }

    button.disabled = true;
    guessesText.innerText = `${wrongGuessCount} / ${maxGuesses}`;

    // Call gameOver function if any of these conditions are met
    if (wrongGuessCount === maxGuesses) return gameOver(false);
    if (correctLetters.length === currentWord.length) return gameOver(true);
};

// Create keyboard buttons
for (let i = 97; i <= 122; i++) {
    const button = document.createElement('button');
    button.innerText = String.fromCharCode(i);
    keyboardDiv.appendChild(button);
    button.addEventListener("click", e => initGame(e.target, String.fromCharCode(i)));
}

// Let user type out letters
document.addEventListener('keydown', function(event) {
    if (gameOverFlag) return;
    const key = event.key.toLowerCase(); // Convert key to lowercase
    // console.log('Key pressed:', key); // Log the key
    if (key.length === 1 && key.match(/[a-z]/i)) {
        const button = Array.from(keyboardDiv.querySelectorAll('button')).find(btn => btn.innerText.toLowerCase() === key); // Convert button text to lowercase
        // console.log('Button found:', button); // Log the button
        if (button && !button.disabled) {
            initGame(button, key);
        }
    }
});

// Allow the user to play again by pressing the "Enter" key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && gameModal.classList.contains('show')) {
        getRandomWord();
    }
});

getRandomWord();
playAgainBtn.addEventListener("click", getRandomWord);

