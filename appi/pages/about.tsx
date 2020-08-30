import React, { Component } from "react";
import { Text, View, ScrollView } from "react-native";

export class about extends Component {
  render() {
    return (
      <ScrollView
        style={{ flex: 1, padding: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ textAlign: "center", fontSize: 100 }}>O jogo</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "center" }}>
            <Text style={{ fontSize: 30, marginBottom: 10, marginTop: 10 }}>
              Regras
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "center" }}>
            <Text
              style={{
                fontSize: 20,
                marginBottom: 10,
                marginTop: 10,
                textAlign: "center",
              }}
            >
              Todos no mundo que sabem acerca do Jogo estão a jogar O Jogo,
              durante todo o tempo, sem pausas. Também pode ser lida,
              alternativamente, como "todas as pessoas no mundo estão,
              obrigatoriamente, o jogando, contudo, boa parte delas apenas não
              sabe ainda.".
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "center" }}>
            <Text
              style={{
                fontSize: 20,
                marginBottom: 10,
                marginTop: 10,
                textAlign: "center",
              }}
            >
              Sempre que alguém pensa no Jogo por qualquer motivo, mesmo que
              apenas por uma fração de segundo, perde.
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "center" }}>
            <Text
              style={{
                fontSize: 20,
                marginBottom: 10,
                marginTop: 10,
                textAlign: "center",
              }}
            >
              A cada vez que O Jogo é perdido, deve ser anunciado por seu
              jogador(quer usando uma frase como "Perdi O Jogo" ("I lost The
              Game"), "Eu perdi" ("I lost"), ou meios alternativos). O anúncio
              pode ser em voz alta, digitado, postado em algum site da Internet,
              ou até mesmo em linguagem de sinais.
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "center" }}>
            <Text
              style={{
                fontSize: 20,
                marginBottom: 10,
                marginTop: 10,
                textAlign: "center",
              }}
            >
              O jogo permite férias de 30 dias sempre que se é encontrado nas
              redes sociais um Golden Ticket, no entanto não é possível sair do
              jogo.
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "center" }}>
            <Text
              style={{
                fontSize: 20,
                marginBottom: 50,
                marginTop: 500,
                textAlign: "center",
              }}
            >
              P.S.: Perdi
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }
}

export default about;
