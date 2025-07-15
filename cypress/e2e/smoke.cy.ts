describe('Landing smoke test', () => {
  it('shows key UI elements on page load', () => {
    cy.visit('/?artist=gosheesh');
    
    // Check that login input exists
    cy.get('input[placeholder="you@example.com"]').should('exist');
    
    // Check that login button exists
    cy.get('button').contains('Login').should('exist');
    
    // Check that the artist name appears
    cy.contains(/gosheesh/i).should('exist');
  });
}); 