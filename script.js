document.addEventListener('DOMContentLoaded', () => {
    const moodButtons = document.querySelectorAll('.mood-btn');
    const recipeDisplay = document.getElementById('recipe-display');
    const dishName = document.getElementById('dish-name');
    const dishImage = document.getElementById('dish-image');
    const dishIngredients = document.getElementById('dish-ingredients');
    const dishInstructions = document.getElementById('dish-instructions');
    const loadingDiv = document.getElementById('loading');
    const vegFilterCheckbox = document.getElementById('veg-filter'); // Get the checkbox

    // API Endpoints
    const API_BASE_URL = 'https://www.themealdb.com/api/json/v1/1/';
    const API_RANDOM = `${API_BASE_URL}random.php`;
    const API_FILTER_CATEGORY = `${API_BASE_URL}filter.php?c=`;
    const API_LOOKUP_ID = `${API_BASE_URL}lookup.php?i=`;
    const VEG_CATEGORY = 'Vegetarian'; // Constant for veg category

    const moodToCategoryMap = {
        happy: ['Dessert', 'Seafood', 'Pasta'], // Bright, celebratory foods
        sad: ['Beef', 'Chicken', 'Pasta', 'Vegetarian', 'Dessert'], // Comforting, warm, sweet
        angry: ['Side', 'Chicken', 'Beef', 'Pork', 'Miscellaneous'], // Spicy, hearty, maybe something to crunch?
        adventurous: ['Side', 'Miscellaneous', 'Lamb', 'Goat', 'Seafood'], // Unique or less common dishes
        stressed: ['Starter', 'Vegan', 'Breakfast', 'Vegetarian'], // Simple, quick, or healthy options
        chill: ['Pasta', 'Chicken', 'Vegetarian', 'Pork', 'Breakfast'], // Easy-going, satisfying meals
        random: null // For completely random selection
    };

    // List of all theme classes to easily remove them
    const themeClasses = ['theme-default', 'theme-happy', 'theme-sad', 'theme-angry', 'theme-adventurous', 'theme-stressed', 'theme-chill'];

    moodButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mood = button.getAttribute('data-mood');
            
            // Update theme
            const themeClass = `theme-${mood}`; // e.g., theme-happy
            document.body.classList.remove(...themeClasses); // Remove all possible theme classes
            if (themeClass !== 'theme-random') { // Don't apply a theme for random
                document.body.classList.add(themeClass);
            } else {
                document.body.classList.add('theme-default'); // Use default for random
            }

            // Pass the filter state to the fetch function
            fetchRecipeByMood(mood, vegFilterCheckbox.checked);
        });
    });

    async function fetchRecipeByMood(mood, isVegOnly) {
        showLoading(true);
        hideRecipe();
        let meal = null;

        try {
            // --- Vegetarian Filter Logic ---            
            if (isVegOnly) {
                // Fetch all vegetarian meals first
                const response = await fetch(`${API_FILTER_CATEGORY}${VEG_CATEGORY}`);
                const data = await response.json();
                
                if (data.meals && data.meals.length > 0) {
                    // Select a random vegetarian meal from the list
                    const randomMealInfo = data.meals[Math.floor(Math.random() * data.meals.length)];
                    // Fetch its full details
                    const detailResponse = await fetch(`${API_LOOKUP_ID}${randomMealInfo.idMeal}`);
                    const detailData = await detailResponse.json();
                    meal = detailData.meals[0];
                } else {
                    // Handle case where no vegetarian meals are found (API issue?)
                     showError('Not Found', `Could not find any vegetarian recipes via the API.`);
                     // No need to return early, finally block handles loading
                }
            // --- END: Vegetarian Filter Logic ---
                
            // --- Original Logic (No Veg Filter) ---
            } else if (mood === 'random' || !moodToCategoryMap[mood]) {
                // Fetch a completely random meal (non-vegetarian path)
                const response = await fetch(API_RANDOM);
                const data = await response.json();
                meal = data.meals[0];
            } else {
                // Mood-based category selection (non-vegetarian path)
                let categories = moodToCategoryMap[mood];
                // Ensure we don't accidentally pick 'Vegetarian' if it's in the mood list but the filter is off
                // Although, allowing it might be fine too. Let's leave it for now.
                const category = categories[Math.floor(Math.random() * categories.length)];

                // Fetch meals by the selected mood category
                const response = await fetch(`${API_FILTER_CATEGORY}${category}`);
                const data = await response.json();

                if (data.meals && data.meals.length > 0) {
                    // Select a random meal from the category
                    const randomMealInfo = data.meals[Math.floor(Math.random() * data.meals.length)];
                    // Fetch its full details
                    const detailResponse = await fetch(`${API_LOOKUP_ID}${randomMealInfo.idMeal}`);
                    const detailData = await detailResponse.json();
                    meal = detailData.meals[0];
                } else {
                    // Fallback to general random if category yields no results
                    console.warn(`No meals found for category: ${category}, fetching random meal.`);
                    const randomResponse = await fetch(API_RANDOM);
                    const randomData = await randomResponse.json();
                    meal = randomData.meals[0];
                }
            }
            // --- END: Original Logic ---

            // Display the final meal (if found)
            if (meal) {
                displayRecipe(meal);
            } else if (!isVegOnly) { // Only show generic error if not in veg-only error state
                showError('Oops!', 'Could not find a suitable recipe this time. Please try another mood or the surprise button!');
            }
        } catch (error) {
            console.error('Error fetching recipe:', error);
            showError('Network Error', 'Failed to load recipe. Please check your internet connection and try again.');
        } finally {
             // Ensure loading is hidden regardless of outcome
            showLoading(false);
        }
    }

    function displayRecipe(meal) {
        dishName.textContent = meal.strMeal;

        if (meal.strMealThumb) {
            dishImage.src = meal.strMealThumb;
            dishImage.alt = meal.strMeal; // Add alt text for accessibility
            dishImage.style.display = 'block'; // Still control image visibility directly
        } else {
            dishImage.src = ''; // Clear src
            dishImage.alt = ''; // Clear alt
            dishImage.style.display = 'none'; // Hide if no image
        }

        dishIngredients.innerHTML = ''; // Clear previous ingredients
        for (let i = 1; i <= 20; i++) {
            const ingredient = meal[`strIngredient${i}`];
            const measure = meal[`strMeasure${i}`];
            // Ensure ingredient exists and is not just whitespace
            if (ingredient && ingredient.trim()) {
                const li = document.createElement('li');
                // Trim measure as well, handle cases where it might be null or just spaces
                const measureText = (measure && measure.trim()) ? `${measure.trim()} ` : '';
                li.textContent = `${measureText}${ingredient.trim()}`;
                dishIngredients.appendChild(li);
            }
        }

        dishInstructions.textContent = meal.strInstructions || 'No instructions provided.'; // Handle potentially missing instructions

        // Use classList to control visibility for fade-in effect
        recipeDisplay.classList.add('visible');
    }

    function showLoading(isLoading) {
        // Keep direct style manipulation for loading indicator as it doesn't need fade
        loadingDiv.style.display = isLoading ? 'block' : 'none';
    }

    function hideRecipe() {
        // Use classList to control visibility for fade-out (implicitly via transition)
        recipeDisplay.classList.remove('visible');

        // Clear previous recipe details when hiding
        // Optional: Delay clearing if you want it to happen after fade-out
        // setTimeout(() => {
            dishName.textContent = '';
            dishImage.src = '';
            dishImage.alt = '';
            dishImage.style.display = 'none';
            dishIngredients.innerHTML = '';
            dishInstructions.textContent = '';
        // }, 500); // Match transition duration
    }

    function showError(errorTitle, errorMessage) {
        dishName.textContent = errorTitle;
        dishIngredients.innerHTML = ''; // Clear ingredients list on error
        dishInstructions.textContent = errorMessage;
        dishImage.src = ''; // Clear image src
        dishImage.alt = ''; // Clear alt text
        dishImage.style.display = 'none'; // Hide image

        // Use classList to show the section (which now displays the error)
        recipeDisplay.classList.add('visible');
    }
}); 