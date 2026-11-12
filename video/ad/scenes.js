// Roteiro do anúncio: cenas, falas da narração e momentos de cada ação (em segundos, contados do início da cena).
// Usado tanto pelo gerador de áudio (Node) quanto pela animação (navegador).
// Para mudar uma fala, edite "vo" e rode de novo:  node ad/build-audio.js && node ad/render.js
(function (root) {
  const VOICE = "pt-BR-AntonioNeural"; // outra opção: "pt-BR-FranciscaNeural"
  const RATE = "+6%";

  const SCENES = [
    { id: "lock", min: 4.6,
      vo: [{ t: 0.25, text: "Onze e quarenta e sete. O celular acende... e a vontade de apostar vem junto.",
             cap: "23:47.|O celular acende…|e a vontade de apostar|vem junto." }],
      ev: { notif: [0.45, 1.45, 2.5] } },

    { id: "mech", min: 4.4,
      vo: [{ t: 0.1, text: "O que prende não é o prêmio. É a expectativa do: e se agora vier?" }],
      ev: { line: [0.1, 0.95, 2.0], hand: [2.75] } },

    { id: "brand", min: 3.6,
      vo: [{ t: 0.15, text: "O Método Desaposta usa essa mesma faísca. Só que a seu favor." }],
      ev: { logo: [0.1], write: [0.7], tag: [1.3] } },

    { id: "home", min: 5.0,
      vo: [{ t: 0.2, text: "Bateu a vontade? Em vez de abrir a bet, você toca no SOS." }],
      ev: { notif: [0.5], swipe: [1.7, 2.1], tap: [3.95] } },

    { id: "games", min: 8.6,
      vo: [{ t: 0.25, text: "Reflexo." }, { t: 2.95, text: "Memória." }, { t: 5.75, text: "Sequência." }, { t: 7.35, text: "Dois minutos que ocupam a cabeça." }],
      ev: {
        seg: [0, 2.8, 5.6],
        hit: [0.6, 1.0, 1.4, 1.8, 2.2],
        flip: [3.2, 3.5, 3.95, 4.25, 4.7, 5.0],
        show: [5.95, 6.25, 6.55, 6.85],
        press: [7.25, 7.5, 7.75, 8.0],
        win: [8.15]
      } },

    { id: "reward", min: 4.4,
      vo: [{ t: 0.2, text: "Cada vitória vira ponto, nível e recompensa surpresa. Sem colocar nenhum real." }],
      ev: { tap: [0.6], open: [0.95] } },

    { id: "vault", min: 4.6,
      vo: [{ t: 0.15, text: "E o dinheiro que iria pra aposta? Fica no seu cofre. Você vê ele crescer, dia após dia." }],
      ev: { pill: [0.55], count: [0.95, 2.0], keep: [2.4] } },

    { id: "progress", min: 3.8,
      vo: [{ t: 0.15, text: "Um dia de cada vez, você retoma o controle." }],
      ev: { fill: [0.3, 1.5], medal: [1.9] } },

    { id: "bonus", min: 6.4,
      vo: [{ t: 0.2, text: "E tem mais: para os 100 primeiros que entrarem, completar 7 dias sem apostar libera uma recompensa de R$ 50 pra sacar na hora." }],
      ev: { card: [0.1], coin: [0.55], tag: [1.4] } },

    { id: "cta", min: 6.2,
      vo: [{ t: 0.2, text: "Método Desaposta. A mesma faísca, sem a perda. Toque no botão e garanta sua vaga entre os 100 primeiros." }],
      ev: { logo: [0.1], tag: [0.7], card: [1.15], tap: [4.9] } },
  ];

  const api = { VOICE, RATE, SCENES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AD = api;
})(this);
