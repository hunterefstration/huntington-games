       // --- GAME VERSION SWITCH (Classic / Rebalanced beta) --- each version keeps its own save; switching reloads the page
       function switchVariant(toRb) {
           saveGame(true);
           try {
               if (toRb) localStorage.setItem(VARIANT_KEY, 'rb'); else localStorage.removeItem(VARIANT_KEY);
           } catch (e) {
               setText(document.getElementById('variant-info'), 'Your browser is blocking saving, so the version can\'t be switched here.');
               return;
           }
           try {
               const u = new URL(location.href);
               if (u.searchParams.has('variant')) { u.searchParams.delete('variant'); location.replace(u.href); return; }
           } catch (e) { /* about:srcdoc and friends */ }
           location.reload();
       }
       (function setupVariantUI() {
           const label = IS_RB ? '↩️ Back to Classic' : '⚖️ Try Rebalanced (beta)';
           ['variant-switch-menu', 'variant-switch-settings'].forEach(id => {
               const b = document.getElementById(id);
               if (!b) return;
               b.textContent = label;
               b.addEventListener('click', () => switchVariant(!IS_RB));
           });
           document.querySelectorAll('[data-rb-badge]').forEach(el => el.classList.toggle('hidden', !IS_RB));
           setText(document.getElementById('variant-info'), IS_RB
               ? 'You are playing Rebalanced (beta): new numbers and its own save. Your Classic save is kept.'
               : 'Rebalanced (beta) is a test version with new numbers and its own save. Your Classic save is kept.');
       })();
       // the panel title says what one general upgrade level gives in this variant
       (function () { const e = document.getElementById('gen-step-label'); if (e) e.textContent = '+' + Math.round(BAL.gen.step * 100) + '%'; })();
