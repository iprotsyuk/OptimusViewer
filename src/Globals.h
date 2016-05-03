#ifndef GLOBALS_H
#define GLOBALS_H

#include <QStringList>

namespace qm {

typedef qint64 SampleId;
typedef QString DataSourceId;
typedef qint64 FeatureId;
typedef qint64 FragmentationSpectrumId;
typedef QString GraphId;
typedef QString FormatId;

namespace GraphIds {

extern const GraphId XIC_ID;
extern const GraphId MASS_PEAK_ID;

QString getHtmlContainerIdForGraph(const GraphId &id);

}

namespace ExportFormats {

extern const QList<FormatId> lossyImageFormats;
extern const QList<FormatId> losslessImageFormats;
extern const QList<FormatId> vectorImageFormats;
extern const QList<FormatId> dataFormats;

}

} // namespace qm

#endif // GLOBALS_H
