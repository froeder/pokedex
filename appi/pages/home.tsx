import React, { Component } from "react";
import {
  Text,
  View,
  FlatList,
  AsyncStorage,
  ScrollView,
  RefreshControl,
} from "react-native";
import { styles } from "./styles";
import { List, Button } from "react-native-paper";
import * as firebase from "firebase";
import "firebase/firestore";

import uuid from "react-native-uuid";

import moment from "moment";

export default class home extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { id: "", refreshing: false };
  }

  async componentDidMount() {
    this.onRefresh();
    AsyncStorage.getItem("@user").then((response) => {
      if (response) {
        let res = JSON.parse(response);

        this.setState({
          id: res.id || 1,
          nome: res.name,
          cidade: res.location,
        });
      }
    });
  }

  setHighScore = (highscore: any): void => {
    const db = firebase.firestore();
    db.collection("highscore")
      .doc(this.state.nome + this.state.id)
      .set(highscore);
  };

  onPress = async () => {
    moment.locale("pt-br");
    const date = moment().format();
    this.setHighScore({
      id: this.state.id,
      nome: this.state.nome,
      criado_em: date,
      cidade: this.state.cidade,
    });
    try {
      this.onRefresh();
    } catch (err) {
      console.log("error creating todo:", err);
    }
  };

  onRefresh = async () => {
    this.setState({ refreshing: true });
    const db = firebase.firestore();
    let snapshot = db.collection("highscore").orderBy("criado_em", "asc").get();
    let dados = (await snapshot).docs.map((doc) => doc.data());
    this.setState({ scores: dados, refreshing: false });
  };

  renderItem = (item) => {
    moment.locale("pt-br");
    let dateFrowNow = moment(item.item.criado_em).fromNow();
    if (item.index <= 2) {
      return (
        <List.Item
          title={item.item.nome}
          description={() => (
            <View>
              <Text>{dateFrowNow}</Text>
              <Text>{item.item.cidade}</Text>
            </View>
          )}
          left={() => (
            <List.Icon
              style={{ borderRadius: 25, backgroundColor: "#FFD700" }}
              icon="trophy"
              color="white"
            />
          )}
        />
      );
    } else {
      return (
        <List.Item
          title={item.item.nome}
          description={() => (
            <View>
              <Text>{dateFrowNow}</Text>
              <Text>{item.item.cidade}</Text>
            </View>
          )}
          left={() => (
            <List.Icon
              style={{ borderRadius: 25, backgroundColor: "gray" }}
              icon="help"
              color="white"
            />
          )}
        />
      );
    }
  };

  render() {
    moment.locale("pt-BR");
    return (
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={this.state.refreshing}
            onRefresh={this.onRefresh}
          />
        }
        style={styles.mainContainer}
      >
        <View style={{ marginBottom: 20 }}>
          <Button mode="contained" color="green" onPress={this.onPress}>
            <Text>Perdi</Text>
          </Button>
        </View>
        <View style={styles.card}>
          <FlatList
            data={this.state.scores || []}
            keyExtractor={(item: Item) => parseInt(item.id)}
            renderItem={(item) => this.renderItem(item)}
          />
        </View>
      </ScrollView>
    );
  }
}

export type Item = {
  id: string;
  nome: string;
  criado_em: string;
  cidade: string;
};

export type HighScore = {
  id: string;
  nome: string;
  criado_em: string;
  cidade: string;
};

export type Props = {};

export type State = {
  id?: string;
  cidade?: string;
  nome?: string;
  refreshing: boolean;
  document?: string;
  highscore?: {
    id: string;
    nome: string;
    criado_em: string;
    cidade: string;
  };
  scores?: any;
};
