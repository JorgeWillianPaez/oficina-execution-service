# language: pt
Funcionalidade: Execução da ordem de serviço na oficina
  Como mecânico
  Quero conduzir o diagnóstico e o reparo pela fila de execução
  Para que a ordem de serviço reflita o andamento real do trabalho

  Contexto:
    Dado uma ordem de trabalho aberta pela saga

  Cenário: Diagnóstico e reparo concluídos
    Quando o mecânico realiza o diagnóstico
    Então a ordem de trabalho fica no estágio "AWAITING_APPROVAL"
    Quando a saga libera o reparo
    E o mecânico inicia o reparo
    E o mecânico conclui o reparo
    Então a ordem de trabalho fica no estágio "COMPLETED"
    E a saga é informada com "execution.event.repair-completed"

  Cenário: Reparo sem diagnóstico aprovado é recusado
    Quando a saga libera o reparo
    Então a saga é informada com "execution.event.repair-failed"
    E a ordem de trabalho fica no estágio "AWAITING_DIAGNOSIS"

  Cenário: Falha durante o reparo
    Quando o mecânico realiza o diagnóstico
    E a saga libera o reparo
    E o mecânico inicia o reparo
    E o mecânico registra falha no reparo por "Peça defeituosa"
    Então a ordem de trabalho fica no estágio "FAILED"
    E a saga é informada com "execution.event.repair-failed"
