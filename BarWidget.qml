import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "GateLogic.js" as Gate

BarWidget {
  id: root
  moduleName: "smf.aegis-gate"

  property int pendingCount: 0

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  function summonOverlay() {
    if (!root.bar) return
    root.bar.run("omarchy-shell shell toggle smf.aegis-gate '{}'")
  }

  function ingestPending(raw) {
    root.pendingCount = Gate.parsePendingFile(raw)
  }

  FileView {
    id: pendingView
    path: Quickshell.env("HOME") + "/.local/share/smf-aegis-gate/pending.json"
    printErrors: false
    onLoaded: root.ingestPending(pendingView.text())
    onLoadFailed: root.pendingCount = 0
  }

  Timer {
    interval: 1500
    running: true
    repeat: true
    onTriggered: {
      try { pendingView.reload() } catch (e) {}
    }
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.pendingCount > 0 ? String(root.pendingCount) : "AG"
    labelVisible: false
    keepSpace: true
    tooltipText: root.pendingCount > 0
      ? ("Aegis Gate — PENDING " + root.pendingCount + " live payload")
      : "Aegis Gate — summon the HUD (not an agent interlock)"
    fixedWidth: vertical ? barSize : Style.space(44)
    fixedHeight: vertical ? Style.space(44) : barSize
    onPressed: function(buttonCode) {
      if (buttonCode === Qt.LeftButton) root.summonOverlay()
    }

    Item {
      anchors.fill: parent
      anchors.margins: Style.spaceReal(5)

      Rectangle {
        anchors.centerIn: parent
        width: parent.width * 0.72
        height: parent.width * 0.78
        rotation: 0
        radius: Style.space(5)
        color: "transparent"
        border.width: 1
        border.color: Util.alpha(root.pendingCount > 0 ? "#F5A524" : Color.accent, 0.7)
      }

      Text {
        anchors.centerIn: parent
        text: root.pendingCount > 0 ? String(root.pendingCount) : "AG"
        color: Color.accent
        font.family: Style.font.family
        font.pixelSize: Style.font.caption
        font.bold: true
      }

      Rectangle {
        visible: root.pendingCount > 0
        width: Style.space(7)
        height: Style.space(7)
        radius: width / 2
        anchors.top: parent.top
        anchors.right: parent.right
        color: "#F5A524"
      }
    }
  }
}
