// Test de l'API OpenAI
fetch('/api/qualify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    nom: "Test Lead",
    email: "test@example.com",
    budget: 150000,
    message: "Je suis intéressé par un appartement"
  })
})
.then(response => response.json())
.then(data => {
  console.log('✅ Réponse API:', data);
})
.catch(error => {
  console.error('❌ Erreur API:', error);
});
