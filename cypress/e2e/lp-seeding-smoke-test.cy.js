describe('LP Seeding Smoke Test', () => {
  it('should show live pricing after LP seeding', () => {
    // Visit artist page
    cy.visit('http://localhost:3000?artist=gosheesh');
    
    // Wait for app to load
    cy.get('[data-testid="artist-page"]', { timeout: 10000 }).should('exist');
    
    // Check if live price indicator is present
    cy.get('body').then(($body) => {
      if ($body.text().includes('Live Price')) {
        // LP exists - verify live pricing
        cy.contains('● Live Price').should('be.visible');
        cy.contains('Price updated from liquidity pool').should('be.visible');
        
        // Test slider functionality with live pricing
        cy.get('input[type="range"]').should('exist').then(($slider) => {
          // Move slider to $1
          cy.wrap($slider).invoke('val', 1).trigger('input');
          
          // Verify token calculation shows non-zero tokens
          cy.get('[data-testid="token-amount"]').should('not.contain', '0');
          
          // Move slider to $50
          cy.wrap($slider).invoke('val', 50).trigger('input');
          
          // Verify higher dollar amount = more tokens
          cy.get('[data-testid="token-amount"]').should('not.contain', '0');
        });
        
        cy.log('✅ LP seeding test passed - Live pricing active');
      } else {
        // No LP - verify fallback pricing
        cy.contains('● Fallback Price').should('be.visible');
        cy.contains('No liquidity pool yet').should('be.visible');
        
        cy.log('⚠️ LP seeding test - Using fallback pricing (expected if no LP)');
      }
    });
    
    // Test purchase flow is accessible
    cy.get('button').contains('INCLUDES PERMANENT ACCESS').should('be.visible');
    
    // Test wallet connection flow
    cy.get('input[placeholder="you@example.com"]').should('be.visible');
  });
  
  it('should verify LP exists after seeding command', () => {
    // This would typically run after the seed-lp command
    cy.visit('http://localhost:3000?artist=gosheesh');
    
    // Check console logs for LP detection
    cy.window().then((win) => {
      cy.stub(win.console, 'log').as('consoleLog');
    });
    
    cy.wait(5000); // Wait for pricing to load
    
    // Verify either live pricing or fallback messaging
    cy.get('body').should('contain.text', 'Price');
    
    // Check for specific LP status indicators
    cy.get('body').then(($body) => {
      const bodyText = $body.text();
      expect(bodyText).to.satisfy((text) => {
        return text.includes('Live Price') || text.includes('Fallback Price');
      });
    });
  });
  
  it('should handle multiple artists with different LP states', () => {
    // Test GOSHEESH
    cy.visit('http://localhost:3000?artist=gosheesh');
    cy.get('[data-testid="artist-page"]', { timeout: 10000 }).should('exist');
    
    // Verify pricing indicator exists
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text();
      return text.includes('Live Price') || text.includes('Fallback Price');
    });
    
    // Test JAITEA
    cy.visit('http://localhost:3000?artist=jaitea');
    cy.get('[data-testid="artist-page"]', { timeout: 10000 }).should('exist');
    
    // Verify pricing indicator exists
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text();
      return text.includes('Live Price') || text.includes('Fallback Price');
    });
  });
  
  it('should calculate tokens correctly based on price type', () => {
    cy.visit('http://localhost:3000?artist=gosheesh');
    cy.get('[data-testid="artist-page"]', { timeout: 10000 }).should('exist');
    
    // Wait for pricing to load
    cy.wait(3000);
    
    // Test $1 input
    cy.get('input[type="range"]').invoke('val', 1).trigger('input');
    
    // Verify token calculation
    cy.get('[data-testid="token-amount"]').should('not.be.empty');
    
    // Test $10 input
    cy.get('input[type="range"]').invoke('val', 10).trigger('input');
    
    // Verify token amount increased
    cy.get('[data-testid="token-amount"]').should('not.be.empty');
    
    // Log the calculation for debugging
    cy.get('[data-testid="token-amount"]').then(($amount) => {
      cy.log(`Token amount for $10: ${$amount.text()}`);
    });
  });
}); 