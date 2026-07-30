
// Poular tabela de cooperados cadastrados
async function populateCooperativeMembersTable() {
    const tbodyCooperativeMembers = document.getElementById("tbodyCooperativeMembers");
    const emptyState = document.querySelector("[data-empty-state]");

    tbodyCooperativeMembers.innerHTML = ``;

    const cooperativeMembersFragment = document.createDocumentFragment();

    let cooperativeMembersQtd = 0;

    try {
        const response = await fetch("/certificados-cooperados/api/v1/cooperative-members");

        if (!response.ok) {
            // VERIFICAR COMO COLOCAR O ERRO AQUI
            throw new Error("Deu erro!");
        }

        const responseJSON = await response.json();

        // A API devolve um array puro; a guarda evita quebrar caso isso mude.
        const cooperativeMembers = Array.isArray(responseJSON) ? responseJSON : [];

        cooperativeMembers.forEach(cooperativeMember => {
            cooperativeMembersQtd++;

            const isActive = cooperativeMember.isActive;

            const badgeClass = isActive ? "badge--success" : "badge--negative";
            const badgeLabel = isActive ? "Ativo" : "Inativo";

            const trCooperativeMembers = document.createElement("tr");

            trCooperativeMembers.innerHTML = `
                <td data-label="Cooperado">
                    <span class="table__primary">${cooperativeMember.name}</span>
                    <span class="table__secondary">${cooperativeMember.email}</span>
                </td>
                <td data-label="Cadastrado em" class="tabular">${cooperativeMember.createdAt}</td>
                <td data-label="Situação">
                    <span class="badge ${badgeClass}">${badgeLabel}</span>
                </td>
            `;

            cooperativeMembersFragment.appendChild(trCooperativeMembers);
        });

        const cooperativeMembersCard = document.getElementById("cardCooperativeMembersQtd");
        cooperativeMembersCard.innerText = cooperativeMembersQtd;

        tbodyCooperativeMembers.appendChild(cooperativeMembersFragment);

        // Só agora, com a resposta em mãos, dá para afirmar que não há cooperado:
        // tem alguém na lista, esconde o bloco; lista vazia, revela.
        emptyState.hidden = cooperativeMembers.length > 0;
    } catch (error) {
        // Falha de rede não é "nenhum cooperado cadastrado" — o bloco continua
        // oculto para não mentir sobre o estado do cadastro.
        emptyState.hidden = true;

        // VERIFICAR COMO COLOCAR O ERRO AQUI
        console.error(error);
    }
}

// Adicionar lógica de inclusão (POST)

// Rodar tudo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", populateCooperativeMembersTable);
} else {
    populateCooperativeMembersTable(); // DOM já está pronto para rodar
}