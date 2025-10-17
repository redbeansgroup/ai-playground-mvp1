// Ensure we're using the ESM version of transformers
import { pipeline } from '@xenova/transformers';

// --- DOM ELEMENT REFERENCES ---
const loaderContainer = document.getElementById('loader-container');
const loaderText = document.getElementById('loader-text');
const generatorUI = document.getElementById('generator-ui');
const reviewUI = document.getElementById('review-ui');
const generateDraftBtn = document.getElementById('generate-draft-btn');
const createPresentationBtn = document.getElementById('create-presentation-btn');
const themeButtons = document.querySelectorAll('.theme-btn');
const slidesContainer = document.querySelector('.slides');
const themeStylesheet = document.getElementById('theme-style');

// --- APP STATE ---
let selectedTheme = 'Professional'; // Default theme
let pipe = null; // To hold the AI pipeline instance

// --- PROMPT ENGINEERING TEMPLATES ---
const prompts = {
    Professional: {
        opener: `CONTEXT: You are an AI assistant refining content for a professional business presentation. TASK: Rewrite the following statement into a clear and impactful opening slide title and a single, concise hook sentence. OUTPUT: {"title": "...", "content": "..."}`,
        core: `CONTEXT: You are an AI assistant refining content for a professional business presentation. TASK: Convert the following raw points into three distinct, professional bullet points. Each bullet should be a complete sentence. OUTPUT: {"title": "...", "content": "- ...\\n- ...\\n- ..."}`,
        closer: `CONTEXT: You are an AI assistant refining content for a professional business presentation. TASK: Synthesize the following text into a concluding slide title and a clear, single-sentence call to action. OUTPUT: {"title": "...", "content": "..."}`
    },
    Engaging: {
        opener: `CONTEXT: You are an AI assistant creating an engaging, story-driven presentation. TASK: Turn the following idea into a catchy, question-based title and a single, intriguing opening sentence. OUTPUT: {"title": "...", "content": "..."}`,
        core: `CONTEXT: You are an AI assistant creating an engaging, story-driven presentation. TASK: Transform the following points into three conversational, easy-to-understand bullet points. Use compelling language. OUTPUT: {"title": "...", "content": "- ...\\n- ...\\n- ..."}`,
        closer: `CONTEXT: You are an AI assistant creating an engaging, story-driven presentation. TASK: Frame the following conclusion as a powerful final thought and a simple, motivating next step for the audience. OUTPUT: {"title": "...", "content": "..."}`
    },
    Academic: {
        opener: `CONTEXT: You are an AI assistant structuring an academic or formal presentation. TASK: Formulate the following topic into a formal title and a concise thesis statement for the first slide. OUTPUT: {"title": "...", "content": "..."}`,
        core: `CONTEXT: You are an AI assistant structuring an academic or formal presentation. TASK: Organize the following points into three clear, data-driven, and logically structured bullet points for a formal slide. OUTPUT: {"title": "...", "content": "- ...\\n- ...\\n- ..."}`,
        closer: `CONTEXT: You are an AI assistant structuring an academic or formal presentation. TASK: Summarize the following points into a formal concluding title and a statement on future implications or further research. OUTPUT: {"title": "...", "content": "..."}`
    }
};


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', initializeAI);

async function initializeAI() {
    // This is the callback function that will be called during model loading
    const progressCallback = (data) => {
        if (data.status === 'progress') {
            const progress = (data.progress).toFixed(2);
            loaderText.textContent = `Loading AI model... ${progress}%`;
        } else {
            loaderText.textContent = `Warming up the AI... ${data.status}`;
        }
    };

    // Load the AI model
    pipe = await pipeline('text2text-generation', 'Xenova/flan-t5-small', { progress_callback: progressCallback });
    
    // Hide the loader and show the generator UI
    loaderContainer.style.display = 'none';
    generatorUI.style.display = 'block';
}

// --- EVENT LISTENERS ---
themeButtons.forEach(button => {
    button.addEventListener('click', () => {
        themeButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        selectedTheme = button.dataset.theme;
    });
});

generateDraftBtn.addEventListener('click', handleGenerateDraft);
createPresentationBtn.addEventListener('click', handleCreatePresentation);


// --- CORE FUNCTIONS ---

/**
 * Handles the "Generate Draft" button click.
 * Gathers user input, runs the AI, and populates the review form.
 */
async function handleGenerateDraft() {
    generateDraftBtn.disabled = true;
    generateDraftBtn.textContent = 'Generating...';

    const slideInputs = [
        { type: 'opener', title: document.getElementById('s1-title').value, content: document.getElementById('s1-content').value },
        { type: 'core', title: document.getElementById('s2-title').value, content: document.getElementById('s2-content').value },
        { type: 'closer', title: document.getElementById('s3-title').value, content: document.getElementById('s3-content').value }
    ];

    try {
        const aiTasks = slideInputs.map(input => refineSlideContent(input.type, input.title, input.content));
        const refinedSlides = await Promise.all(aiTasks);

        // Populate the review form
        refinedSlides.forEach((slide, index) => {
            document.getElementById(`r${index + 1}-title`).value = slide.title;
            document.getElementById(`r${index + 1}-content`).value = slide.content.replace(/\\n/g, '\n');
        });

        // Switch to the review UI
        generatorUI.style.display = 'none';
        reviewUI.style.display = 'block';

    } catch (error) {
        console.error("Error generating draft:", error);
        alert("An error occurred while generating the draft. Please try again.");
    } finally {
        generateDraftBtn.disabled = false;
        generateDraftBtn.textContent = 'Generate Draft';
    }
}

/**
 * Calls the AI to refine content for a single slide.
 * @param {string} slideType - 'opener', 'core', or 'closer'.
 * @param {string} title - The user-provided title.
 * @param {string} content - The user-provided content.
 * @returns {Promise<object>} - A promise that resolves to { title, content }.
 */
async function refineSlideContent(slideType, title, content) {
    const promptTemplate = prompts[selectedTheme][slideType];
    const fullPrompt = `${promptTemplate}\n\nINPUT: {"title": "${title}", "content": "${content}"}`;

    const output = await pipe(fullPrompt, { max_new_tokens: 100 });
    const resultText = output[0].generated_text;

    try {
        // The model should output valid JSON, but we'll parse it safely
        return JSON.parse(resultText);
    } catch (e) {
        console.error("Failed to parse AI output as JSON:", resultText);
        // Fallback in case of invalid JSON
        return { title: title, content: "AI failed to generate content. Please edit manually." };
    }
}

/**
 * Handles the "Create Presentation" button click.
 * Gathers final text, generates HTML, and initializes Reveal.js.
 */
function handleCreatePresentation() {
    const finalSlides = [
        { title: document.getElementById('r1-title').value, content: document.getElementById('r1-content').value },
        { title: document.getElementById('r2-title').value, content: document.getElementById('r2-content').value },
        { title: document.getElementById('r3-title').value, content: document.getElementById('r3-content').value }
    ];

    // Generate the HTML for the slides
    const presentationHTML = finalSlides.map(slide => {
        const contentHTML = slide.content.split('\n')
            .filter(line => line.trim() !== '')
            .map(line => `<li>${line.replace(/^- /, '')}</li>`)
            .join('');
        return `<section><h2>${slide.title}</h2><ul>${contentHTML}</ul></section>`;
    }).join('');

    slidesContainer.innerHTML = presentationHTML;

    // Apply the selected visual theme
    const themeMap = {
        Professional: 'dist/theme/black.css',
        Engaging: 'dist/theme/sky.css',
        Academic: 'dist/theme/serif.css'
    };
    themeStylesheet.setAttribute('href', themeMap[selectedTheme]);

    // Hide all UI and initialize Reveal.js
    reviewUI.style.display = 'none';
    Reveal.initialize({
        hash: true,
        plugins: [] // Add any Reveal plugins here if needed
    });
}
