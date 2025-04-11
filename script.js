document.addEventListener('DOMContentLoaded', () => {
    const moodButtons = document.querySelectorAll('.mood-btn');
    const recipeDisplay = document.getElementById('recipe-display');
    const dishName = document.getElementById('dish-name');
    const dishImage = document.getElementById('dish-image');
    const dishInstructions = document.getElementById('dish-instructions');
    const dishCalories = document.getElementById('dish-calories');
    const dishFat = document.getElementById('dish-fat');
    const dishSourceLink = document.getElementById('dish-source-link');
    const loadingDiv = document.getElementById('loading');
    const vegFilterCheckbox = document.getElementById('veg-filter');
    const maxFatInput = document.getElementById('max-fat-filter');

    // --- Spoonacular API Config ---
    const SPOONACULAR_API_KEY = '2fb0a2ef5c0b4dec884098b6b0019000'; 
    const API_SEARCH_RECIPES = 'https://api.spoonacular.com/recipes/complexSearch';

    // --- Mood Mapping for Spoonacular ---
    // EXTREMELY SIMPLE: One keyword, no calorie limits for failing moods.
    const moodToSearchParams = {
        happy:       { query: 'dessert' },        // Single keyword
        sad:         { query: 'comfort' },        // Single keyword
        angry:       { query: 'spicy' },          // Single keyword
        adventurous: { query: 'sea' },  // Changed from 'exotic'
        stressed:    { query: 'quick easy healthy', maxCalories: 800, maxReadyTime: 45 }, // Keep this one as it worked
        chill:       { query: 'tasty' },          // Single keyword
        random:      { query: '' } 
    };

    const themeClasses = ['theme-default', 'theme-happy', 'theme-sad', 'theme-angry', 'theme-adventurous', 'theme-stressed', 'theme-chill'];

    moodButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mood = button.getAttribute('data-mood');
            updateTheme(mood);
            fetchRecipeByMood(mood, vegFilterCheckbox.checked, maxFatInput.value);
        });
    });

    function updateTheme(mood) {
        const themeClass = `theme-${mood}`;
        document.body.classList.remove(...themeClasses);
        if (themeClass !== 'theme-random' && themeClasses.includes(themeClass)) {
            document.body.classList.add(themeClass);
        } else {
            document.body.classList.add('theme-default');
        }
    }

    async function fetchRecipeByMood(mood, isVegOnly, maxFat) {
        showLoading(true);
        hideRecipe();
        let meal = null;

        try {
            // --- Build Spoonacular Query Params ---            
            const params = new URLSearchParams({
                apiKey: SPOONACULAR_API_KEY,
                number: 20, // Fetch a few options to pick from
                addRecipeNutrition: true, // Request nutritional info
                sort: 'random', // Ask API to randomize results
                instructionsRequired: true, // Ensure we get recipes with instructions
            });

            const moodParams = moodToSearchParams[mood] || moodToSearchParams.random;

            // Add mood-based parameters
            if (moodParams.query) params.append('query', moodParams.query);
            if (moodParams.type) params.append('type', moodParams.type);
            if (moodParams.cuisine) params.append('cuisine', moodParams.cuisine);
            if (moodParams.maxReadyTime) params.append('maxReadyTime', moodParams.maxReadyTime);
            // Add calorie filters from mood mapping
            if (moodParams.minCalories) params.append('minCalories', moodParams.minCalories);
            if (moodParams.maxCalories) params.append('maxCalories', moodParams.maxCalories);

            // Add filters
            if (isVegOnly) {
                params.append('diet', 'vegetarian');
            }
            // Ensure maxFat is a positive number before adding
            const maxFatValue = parseInt(maxFat, 10);
            if (!isNaN(maxFatValue) && maxFatValue > 0) {
                params.append('maxFat', maxFatValue);
            }

            // --- Make API Call --- 
            const fullApiUrl = `${API_SEARCH_RECIPES}?${params.toString()}`;
            console.log("Attempting to fetch:", fullApiUrl);
            const response = await fetch(fullApiUrl);
            
            if (!response.ok) {
                // Handle API errors (like quota exceeded, invalid key)
                const errorData = await response.json();
                throw new Error(`API Error (${response.status}): ${errorData.message || 'Failed to fetch recipes'}`);
            }

            const data = await response.json();

            // --- Process Results --- 
            if (data.results && data.results.length > 0) {
                // Pick one random recipe from the filtered results
                // Although we asked API to sort random, let's randomize again client-side for safety
                meal = data.results[Math.floor(Math.random() * data.results.length)];
                console.log("Selected Meal:", meal); // Log for debugging
                displayRecipe(meal);
            } else {
                // Handle case where no recipes match the criteria
                showError('No Recipes Found', 'Could not find any recipes matching your mood and filter criteria. Try adjusting the filters!');
            }

        } catch (error) {
            console.error('Error fetching recipe:', error);
            // Display specific API error or generic network error
            showError('Error', error.message.startsWith('API Error') ? error.message : 'Failed to load recipe. Check your internet connection or API key/quota.');
        } finally {
            showLoading(false);
        }
    }

    function displayRecipe(meal) {
        // --- Display Basic Info --- 
        dishName.textContent = meal.title || 'N/A';

        if (meal.image) {
            dishImage.src = meal.image;
            dishImage.alt = meal.title;
            dishImage.style.display = 'block';
        } else {
            dishImage.src = '';
            dishImage.alt = '';
            dishImage.style.display = 'none';
        }

        // --- Display Nutrition (if available) ---
        let calories = 'N/A';
        let fat = 'N/A';
        if (meal.nutrition && meal.nutrition.nutrients) {
            const calorieInfo = meal.nutrition.nutrients.find(n => n.name === 'Calories');
            const fatInfo = meal.nutrition.nutrients.find(n => n.name === 'Fat');
            if (calorieInfo) calories = `${Math.round(calorieInfo.amount)} ${calorieInfo.unit}`;
            if (fatInfo) fat = `${Math.round(fatInfo.amount)} ${fatInfo.unit}`;
        }
        dishCalories.textContent = calories;
        dishFat.textContent = fat;
        
        // --- Display Summary/Link (Complex Search doesn't return full ingredients/instructions) ---
        // We need to link to the source for full details
        dishInstructions.textContent = meal.summary ? stripHtml(meal.summary) : 'No summary available. Click link for full recipe.';
        
        if(meal.sourceUrl) {
            dishSourceLink.href = meal.sourceUrl;
            dishSourceLink.textContent = `View Full Recipe at ${meal.sourceName || 'Source'}`;
            dishSourceLink.style.display = 'inline-block';
        } else {
            dishSourceLink.href = '#';
            dishSourceLink.textContent = '';
            dishSourceLink.style.display = 'none';
        }

        recipeDisplay.classList.add('visible');
    }

    function showLoading(isLoading) {
        loadingDiv.style.display = isLoading ? 'block' : 'none';
    }

    function hideRecipe() {
        recipeDisplay.classList.remove('visible');
        // Clear details
        dishName.textContent = '';
        dishImage.src = '';
        dishImage.alt = '';
        dishImage.style.display = 'none';
        dishInstructions.textContent = '';
        dishCalories.textContent = 'N/A'; // Reset nutrition
        dishFat.textContent = 'N/A'; // Reset nutrition
        dishSourceLink.href = '#'; // Reset link
        dishSourceLink.textContent = '';
        dishSourceLink.style.display = 'none';
    }

    function showError(errorTitle, errorMessage) {
        hideRecipe(); // Clear previous recipe before showing error
        dishName.textContent = errorTitle;
        dishInstructions.textContent = errorMessage; // Display error message in instructions area
        recipeDisplay.classList.add('visible'); // Show the section to display the error
    }

    // Helper function to remove HTML tags (basic version)
    function stripHtml(html){
       let tmp = document.createElement("DIV");
       tmp.innerHTML = html;
       return tmp.textContent || tmp.innerText || "";
    }
}); 
