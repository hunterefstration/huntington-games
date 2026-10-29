
        let state = {
            money: 50.00,
            beans: 0, milk: 0, cups: 0, brewed: 0,
            baristas: 0, marketingLevel: 0, premiumLevel: 0,
            pricePerCoffee: 4.00,
            workProgress: 0,
            workPower: 0.50,
            costs: { beans: 10, milk: 5, cups: 5, barista: 100, marketing: 75, premium: 150 }
        };


        function log(message, type = 'info') {
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            let color = type === 'success' ? 'text-green-400' : (type === 'error' ? 'text-red-400' : 'text-slate-300');
            entry.innerHTML = `<span class="${color}">${message}</span>`;
            const container = document.getElementById('log-container');
            container.appendChild(entry);
            container.scrollTop = container.scrollHeight;
        }


        function updateUI() {
            document.getElementById('ui-money').innerText = `$${state.money.toFixed(2)}`;
            document.getElementById('ui-beans').innerText = state.beans;
            document.getElementById('ui-milk').innerText = state.milk;
            document.getElementById('ui-cups').innerText = state.cups;
            document.getElementById('ui-brewed').innerText = state.brewed;
            
            // Update Upgrade Stats
            document.getElementById('ui-baristas').innerText = state.baristas;
            document.getElementById('ui-marketing').innerText = state.marketingLevel;
            document.getElementById('ui-premium').innerText = state.premiumLevel;
            document.getElementById('ui-price').innerText = state.pricePerCoffee.toFixed(2);
            document.getElementById('ui-work-value').innerText = (state.workPower + (state.marketingLevel * 0.25)).toFixed(2);


            // UPDATE PRICES ON BUTTONS
            document.getElementById('cost-barista').innerText = `-$${state.costs.barista.toFixed(2)}`;
            document.getElementById('cost-marketing').innerText = `-$${state.costs.marketing.toFixed(2)}`;
            document.getElementById('cost-premium').innerText = `-$${state.costs.premium.toFixed(2)}`;
            
            // Disable buttons if not enough money
            document.getElementById('btn-brew').disabled = (state.beans < 1 || state.milk < 1 || state.cups < 1);
            document.getElementById('btn-buy-beans').disabled = state.money < state.costs.beans;
            document.getElementById('btn-buy-milk').disabled = state.money < state.costs.milk;
            document.getElementById('btn-buy-cups').disabled = state.money < state.costs.cups;
            document.getElementById('btn-upg-barista').disabled = state.money < state.costs.barista;
            document.getElementById('btn-upg-marketing').disabled = state.money < state.costs.marketing;
            document.getElementById('btn-upg-premium').disabled = state.money < state.costs.premium;
        }


        function doWork() {
            if (state.workProgress >= 100) return;
            state.workProgress += 20;
            document.getElementById('work-bar').style.width = state.workProgress + '%';
            if (state.workProgress >= 100) {
                let earnings = state.workPower + (state.marketingLevel * 0.25);
                state.money += earnings;
                setTimeout(() => {
                    state.workProgress = 0;
                    document.getElementById('work-bar').style.width = '0%';
                    updateUI();
                }, 150);
            }
            updateUI();
        }


        function buyItem(item) {
            if (state.money >= state.costs[item]) {
                state.money -= state.costs[item];
                state[item] += 20;
                log(`Restocked ${item}!`, 'info');
                updateUI();
            }
        }


        function brewCoffee() {
            if (state.beans >= 1 && state.milk >= 1 && state.cups >= 1) {
                state.beans--; state.milk--; state.cups--;
                state.brewed++;
                updateUI();
            }
        }


        function buyUpgrade(type) {
            if (state.money >= state.costs[type]) {
                state.money -= state.costs[type];
                
                if (type === 'barista') {
                    state.baristas++;
                    state.costs.barista = Math.floor(state.costs.barista * 1.6); // Price jumps 60%
                } else if (type === 'marketing') {
                    state.marketingLevel++;
                    state.costs.marketing = Math.floor(state.costs.marketing * 1.5);
                } else if (type === 'premium') {
                    state.premiumLevel++;
                    state.pricePerCoffee += 1.50; // Big price increase for customers
                    state.costs.premium = Math.floor(state.costs.premium * 2.2); // Big cost increase
                }
                
                log(`Upgraded ${type}! Next one is more expensive.`, 'success');
                updateUI();
            }
        }


        // Game Loop
        setInterval(() => {
            if (state.baristas > 0) {
                for (let i = 0; i < state.baristas; i++) {
                    if (state.beans >= 1 && state.milk >= 1 && state.cups >= 1) {
                        state.beans--; state.milk--; state.cups--;
                        state.brewed++;
                    }
                }
            }
            if (state.brewed > 0) {
                let demand = 1 + state.marketingLevel;
                let toSell = Math.min(state.brewed, demand);
                state.money += toSell * state.pricePerCoffee;
                state.brewed -= toSell;
                if(toSell > 0) log(`Sold ${toSell} cups.`, 'success');
            }
            updateUI();
        }, 2000);


        updateUI();
    